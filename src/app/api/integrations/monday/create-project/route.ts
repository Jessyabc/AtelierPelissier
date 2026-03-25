import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { getMondayItemAsProject } from "@/lib/monday";
import { requireRole } from "@/lib/auth/session";

/**
 * POST /api/integrations/monday/create-project
 * Body: { boardId: string, itemId: string }
 * Creates a draft project from a Monday.com item (name, job number, client, notes mapped from columns).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["admin", "planner"]);
    if (!session.ok) return session.response;

    const body = await req.json();
    const boardId = body.boardId as string | undefined;
    const itemId = body.itemId as string | undefined;

    if (!boardId?.trim() || !itemId?.trim()) {
      return NextResponse.json(
        { error: "boardId and itemId are required." },
        { status: 400 }
      );
    }

    const config = await getAppConfig();
    const apiKey = config.integrations?.mondayApiKey as string | undefined;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Monday.com API key not configured. Add it in Admin Hub → Integrations." },
        { status: 400 }
      );
    }

    const mapped = await getMondayItemAsProject(apiKey.trim(), boardId.trim(), itemId.trim());

    const name = mapped.name || "New project";
    const jobNumber = mapped.jobNumber?.trim() || null;
    const types = "custom";

    const project = await prisma.project.create({
      data: {
        name,
        type: "custom",
        types,
        jobNumber,
        notes: mapped.notes ?? null,
        isDraft: true,
        isDone: false,
        clientFirstName: mapped.clientName ? mapped.clientName.split(/\s+/)[0] ?? null : null,
        clientLastName: mapped.clientName ? mapped.clientName.split(/\s+/).slice(1).join(" ") || null : null,
      },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        jobNumber: project.jobNumber,
        isDraft: project.isDraft,
      },
      message: "Draft project created. You can open it to add rooms, cutlist, and link a client.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project from Monday item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
