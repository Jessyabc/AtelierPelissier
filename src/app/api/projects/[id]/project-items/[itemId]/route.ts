import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth/guard";

/**
 * GET: Get a single project item
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const item = await prisma.projectItem.findFirst({
    where: { id: itemId, projectId },
    include: {
      processTemplate: { select: { id: true, name: true } },
      taskItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Project item not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

/**
 * PATCH: Update a project item
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body as { type?: string; label?: string; processTemplateId?: string | null };

  const item = await prisma.projectItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!item) {
    return NextResponse.json({ error: "Project item not found" }, { status: 404 });
  }

  const updateData: { type?: string; label?: string; processTemplateId?: string | null } = {};
  if (data.type !== undefined) updateData.type = String(data.type).trim();
  if (data.label !== undefined) updateData.label = String(data.label).trim();
  if (data.processTemplateId !== undefined) updateData.processTemplateId = data.processTemplateId?.trim() || null;

  if (Object.keys(updateData).length === 0) {
    const full = await prisma.projectItem.findUnique({
      where: { id: itemId },
      include: {
        processTemplate: { select: { id: true, name: true } },
        taskItems: { orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(full ?? item);
  }

  const updated = await prisma.projectItem.update({
    where: { id: itemId },
    data: updateData,
    include: {
      processTemplate: { select: { id: true, name: true } },
      taskItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json(updated);
}

/**
 * DELETE: Remove a project item
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  const item = await prisma.projectItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!item) {
    return NextResponse.json({ error: "Project item not found" }, { status: 404 });
  }
  await prisma.projectItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
