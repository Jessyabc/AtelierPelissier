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
  const { id: projectId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body as { type?: string; label?: string; processTemplateId?: string };
  const type = (data?.type as string)?.trim() || "custom";
  const label = (data?.label as string)?.trim() || "New item";
  const processTemplateId = (data?.processTemplateId as string)?.trim() || null;

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

  const maxOrder = await prisma.projectItem.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const item = await prisma.projectItem.create({
    data: { projectId, type, label, processTemplateId, sortOrder },
    include: {
      processTemplate: { select: { id: true, name: true } },
      taskItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  // Seed task items from process template if provided
  if (processTemplateId) {
    const labels = await getOrderedStepLabels(processTemplateId);
    if (labels !== null) {
      for (let i = 0; i < labels.length; i++) {
        await prisma.projectItemTaskItem.create({
          data: { projectItemId: item.id, label: labels[i], sortOrder: i },
        });
      }
    }
  }

  const withItems = await prisma.projectItem.findUnique({
    where: { id: item.id },
    include: {
      processTemplate: { select: { id: true, name: true } },
      taskItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json(withItems ?? item);
}
