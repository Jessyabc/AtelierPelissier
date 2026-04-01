import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { fetchMondayBoardItems, fetchMondayItemFileAssets } from "@/lib/monday";
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

  const newEntries: { boardId: string; itemId: string; overrides?: any }[] = [];

  // Keep cron reliable: cap how many we propose per run, and how many PDFs we attempt.
  const MAX_NEW_PER_RUN = 80;
  const MAX_PDF_PARSE = 8;
  let pdfParsed = 0;

  for (const b of boards) {
    if (newEntries.length >= MAX_NEW_PER_RUN) break;
    const items = await fetchMondayBoardItems(apiKey, b.id, 120);
    for (const it of items) {
      if (newEntries.length >= MAX_NEW_PER_RUN) break;

      const ids: { id: string; name: string }[] = [{ id: String(it.id), name: it.name }];
      for (const s of it.subitems ?? []) ids.push({ id: String(s.id), name: s.name });

      for (const x of ids) {
        if (newEntries.length >= MAX_NEW_PER_RUN) break;
        if (seen.has(x.id)) continue;

        newlySeen.push(x.id);

        let overrides: any = undefined;
        if (pdfParsed < MAX_PDF_PARSE) {
          try {
            const assets = await fetchMondayItemFileAssets(apiKey, x.id);
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

        newEntries.push({ boardId: b.id, itemId: x.id, ...(overrides ? { overrides } : {}) });
      }
    }
  }

  // Update seen list (bounded)
  const nextSeen = Array.from(
    new Set([...(config.integrations?.mondaySeenItemIds as string[] | undefined ?? []), ...newlySeen])
  );
  const bounded = nextSeen.slice(-2000);

  await prisma.appConfig.update({
    where: { id: config.id },
    data: {
      integrations: JSON.stringify({
        ...config.integrations,
        mondaySeenItemIds: bounded,
      }),
    },
  });

  if (newEntries.length === 0) {
    return NextResponse.json({ ok: true, proposed: 0, pdfParsed, message: "No new Monday items detected." });
  }

  // Create a conversation + pending action message for the UI (/assistant) to show.
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
        `I found ${newEntries.length} new Monday item(s) on your configured boards. ` +
        `I can propose creating draft projects for them. Click Approve to create the drafts.`,
      functionCall: JSON.stringify(payload),
      actionStatus: "pending",
    },
  });

  return NextResponse.json({ ok: true, proposed: newEntries.length, pdfParsed, conversationId: convo.id });
}

