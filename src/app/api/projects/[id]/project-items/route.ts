import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderedStepLabels } from "@/lib/processTemplate";

/**
 * GET: List project items (deliverables) for a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const items = await prisma.projectItem.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc", createdAt: "asc" },
    include: {
      processTemplate: { select: { id: true, name: true } },
      taskItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json(items);
}

/**
 * POST: Create a project item (deliverable)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const data = body as { type?: string; label?: string; processTemplateId?: string; extraTaskLabels?: string[] };
    const type = (data?.type as string)?.trim() || "custom";
    const label = (data?.label as string)?.trim() || "New item";
    const processTemplateId = (data?.processTemplateId as string)?.trim() || null;
    const extraTaskLabels = Array.isArray(data?.extraTaskLabels)
      ? data.extraTaskLabels.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 30)
      : [];

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, parentProjectId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.parentProjectId) {
      return NextResponse.json({ error: "Project items only on main projects" }, { status: 400 });
    }

    if (processTemplateId) {
      const tpl = await prisma.processTemplate.findUnique({
        where: { id: processTemplateId },
        select: { id: true },
      });
      if (!tpl) {
        return NextResponse.json(
          { error: "Process template not found. Refresh the page and pick a template again." },
          { status: 400 }
        );
      }
    }

    const maxOrder = await prisma.projectItem.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    let templateLabels: string[] = [];
    if (processTemplateId) {
      const labels = await getOrderedStepLabels(processTemplateId);
      if (labels === null) {
        return NextResponse.json({ error: "Process template not found" }, { status: 400 });
      }
      templateLabels = labels;
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.projectItem.create({
        data: { projectId, type, label, processTemplateId, sortOrder },
        include: {
          processTemplate: { select: { id: true, name: true } },
          taskItems: { orderBy: { sortOrder: "asc" } },
        },
      });

      for (let i = 0; i < templateLabels.length; i++) {
        await tx.projectItemTaskItem.create({
          data: { projectItemId: created.id, label: templateLabels[i], sortOrder: i },
        });
      }

      if (extraTaskLabels.length > 0) {
        const existing = await tx.projectItemTaskItem.findMany({
          where: { projectItemId: created.id },
          select: { label: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });
        const existingNorm = new Set(existing.map((t) => t.label.trim().toLowerCase()));
        const baseOrder = (existing[existing.length - 1]?.sortOrder ?? -1) + 1;
        let offset = 0;
        for (const t of extraTaskLabels) {
          const norm = t.toLowerCase();
          if (existingNorm.has(norm)) continue;
          await tx.projectItemTaskItem.create({
            data: { projectItemId: created.id, label: t, sortOrder: baseOrder + offset },
          });
          existingNorm.add(norm);
          offset++;
        }
      }

      return tx.projectItem.findUnique({
        where: { id: created.id },
        include: {
          processTemplate: { select: { id: true, name: true } },
          taskItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    return NextResponse.json(item);
  } catch (err) {
    console.error("POST /api/projects/[id]/project-items", err);
    const msg = err instanceof Error ? err.message : "Failed to create room";
    if (msg.includes("P2003") || msg.toLowerCase().includes("foreign key")) {
      return NextResponse.json(
        { error: "Could not link process template to this project. Try again or pick another template." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
