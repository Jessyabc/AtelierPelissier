import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH: Update a task item (label, isDone)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { label, isDone } = body as { label?: string; isDone?: boolean };

  const item = await prisma.projectTaskItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!item) {
    return NextResponse.json({ error: "Task item not found" }, { status: 404 });
  }

  const updateData: { label?: string; isDone?: boolean } = {};
  if (label !== undefined) updateData.label = String(label).trim();
  if (isDone !== undefined) updateData.isDone = Boolean(isDone);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(item);
  }

  const updated = await prisma.projectTaskItem.update({
    where: { id: itemId },
    data: updateData,
  });
  return NextResponse.json(updated);
}

/**
 * DELETE: Remove a task item
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const item = await prisma.projectTaskItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!item) {
    return NextResponse.json({ error: "Task item not found" }, { status: 404 });
  }
  await prisma.projectTaskItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
