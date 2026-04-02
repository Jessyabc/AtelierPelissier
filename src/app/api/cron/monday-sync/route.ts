import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { fetchAllMondayBoardItems, fetchMondayItemFileAssets, parseMondayItemName } from "@/lib/monday";
import { parsePdfWithLlamaParse } from "@/lib/llamaparse";
import pdfParse from "pdf-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function assertCronAuth(req: NextRequest): string | null {
  const want = process.env.CRON_SECRET?.trim();
  if (!want) return "CRON_SECRET not set";
  const got = req.headers.get("x-cron-secret")?.trim();
  if (!got || got !== want) return "Unauthorized";
  return null;
}

function extractFromText(text: string): { jobNumber?: string; clientName?: string; address?: string } {
  const t = text.replace(/\r/g, "\n");

  const job = t.match(/\bMC-\d{3,6}\b/i)?.[0]?.toUpperCase();

  const client =
    t.match(/(?:Client|Customer|Nom)\s*[:\-]\s*([^\n]{2,80})/i)?.[1]?.trim() ??
    t.match(/(?:Nom du client)\s*[:\-]\s*([^\n]{2,80})/i)?.[1]?.trim() ??
    undefined;

  const addr =
    t.match(/(?:Adresse|Address)\s*[:\-]\s*([^\n]{5,120})/i)?.[1]?.trim() ??
    undefined;

  return {
    ...(job ? { jobNumber: job } : {}),
    ...(client ? { clientName: client } : {}),
    ...(addr ? { address: addr } : {}),
  };
}

async function pdfToText(buf: Buffer, filename: string): Promise<string> {
  try {
    const parsed = await pdfParse(buf);
    const txt = (parsed.text ?? "").trim();
    if (txt) return txt;
  } catch {
    // ignore, fallback to OCR
  }
  const ocr = await parsePdfWithLlamaParse(buf, filename);
  return (ocr.text ?? "").trim();
}

/**
 * POST /api/cron/monday-sync
 *
 * Twice-weekly cron: detect new Monday items/subitems on saved boards and create a PENDING AI action
 * (requires Approve) to create draft projects.
 *
 * Security: requires header x-cron-secret == CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const authErr = assertCronAuth(req);
  if (authErr) return NextResponse.json({ error: authErr }, { status: 401 });

  const config = await getAppConfig();
  const apiKey = (config.integrations?.mondayApiKey as string | undefined)?.trim();
  const boards = (config.integrations?.mondayBoards as { id: string; name?: string }[] | undefined) ?? [];
  if (!apiKey) return NextResponse.json({ error: "Monday API key not configured" }, { status: 400 });
  if (boards.length === 0) return NextResponse.json({ error: "No Monday boards configured" }, { status: 400 });

  const seen = new Set<string>(((config.integrations?.mondaySeenItemIds as string[] | undefined) ?? []).map(String));
  const newlySeen: string[] = [];
  const COMPLETED_RE = /complete|done|terminé|fermé|closed/i;

  // Parent items only — subitems become rooms during project creation.
  const newEntries: { boardId: string; itemId: string; overrides?: any }[] = [];

  const MAX_NEW_PER_RUN = 80;
  const MAX_PDF_PARSE = 8;
  let pdfParsed = 0;

  for (const b of boards) {
    if (newEntries.length >= MAX_NEW_PER_RUN) break;
    // B-08: full board pagination instead of 120-limit
    const items = await fetchAllMondayBoardItems(apiKey, b.id);
    for (const it of items) {
      if (newEntries.length >= MAX_NEW_PER_RUN) break;

      const parentId = String(it.id);
      // Mark parent + all subitems as seen together (they're one project)
      const allIds = [parentId, ...(it.subitems ?? []).map((s) => String(s.id))];
      const alreadySeen = allIds.every((id) => seen.has(id));
      if (alreadySeen) continue;

      // B-09: skip items whose status looks completed
      const status = it.column_values?.find((c) => /status|état|state/i.test(c.column?.title ?? ""))?.text ?? "";
      if (COMPLETED_RE.test(status)) {
        allIds.forEach((id) => newlySeen.push(id));
        continue;
      }

      // B-06: skip if a project with this job number already exists in the app
      const parsed = parseMondayItemName(it.name ?? "");
      if (parsed.jobNumber) {
        const existing = await prisma.project.findFirst({
          where: { jobNumber: parsed.jobNumber },
          select: { id: true },
        });
        if (existing) {
          allIds.forEach((id) => newlySeen.push(id));
          continue;
        }
      }

      let overrides: any = undefined;
      if (pdfParsed < MAX_PDF_PARSE) {
        try {
          const assets = await fetchMondayItemFileAssets(apiKey, parentId);
          const pdf = assets.find((a) => (a.fileExtension ?? "").toLowerCase() === "pdf") ?? null;
          const url = pdf?.publicUrl ?? pdf?.url ?? null;
          if (url) {
            const fileRes = await fetch(url);
            if (fileRes.ok) {
              const arr = await fileRes.arrayBuffer();
              const buf = Buffer.from(arr);
              const text = await pdfToText(buf, pdf?.name ?? "monday.pdf");
              if (text) {
                overrides = extractFromText(text);
                pdfParsed++;
              }
            }
          }
        } catch {
          // keep cron resilient
        }
      }

      allIds.forEach((id) => newlySeen.push(id));
      newEntries.push({ boardId: b.id, itemId: parentId, ...(overrides ? { overrides } : {}) });
    }
  }

  if (newEntries.length === 0) {
    // B-07: still persist newly-seen IDs (completed/existing items we skipped)
    if (newlySeen.length > 0) {
      const nextSeen = Array.from(
        new Set([...(config.integrations?.mondaySeenItemIds as string[] | undefined ?? []), ...newlySeen])
      ).slice(-10_000);
      await prisma.appConfig.update({
        where: { id: config.id },
        data: { integrations: JSON.stringify({ ...config.integrations, mondaySeenItemIds: nextSeen }) },
      });
    }
    return NextResponse.json({ ok: true, proposed: 0, pdfParsed, message: "No new Monday items detected." });
  }

  // B-07: Create the AI message FIRST, then persist seen list.
  // If message creation fails, items stay unseen and will be retried next run.
  const convo = await prisma.aiConversation.create({
    data: { scope: "global", projectId: null },
  });

  const payload =
    newEntries.length === 1
      ? { action: "createProjectFromMonday", boardId: newEntries[0].boardId, itemId: newEntries[0].itemId }
      : { action: "createProjectFromMonday", items: newEntries };

  await prisma.aiMessage.create({
    data: {
      conversationId: convo.id,
      role: "assistant",
      content:
        `I found ${newEntries.length} new project(s) on your Monday boards. ` +
        `Click Approve to create draft projects (subitems will become rooms automatically).`,
      functionCall: JSON.stringify(payload),
      actionStatus: "pending",
    },
  });

  // B-07 + B-20: Persist seen AFTER successful message creation. Cap at 10k (was 2k).
  const nextSeen = Array.from(
    new Set([...(config.integrations?.mondaySeenItemIds as string[] | undefined ?? []), ...newlySeen])
  ).slice(-10_000);

  await prisma.appConfig.update({
    where: { id: config.id },
    data: { integrations: JSON.stringify({ ...config.integrations, mondaySeenItemIds: nextSeen }) },
  });

  return NextResponse.json({ ok: true, proposed: newEntries.length, pdfParsed, conversationId: convo.id });
}

