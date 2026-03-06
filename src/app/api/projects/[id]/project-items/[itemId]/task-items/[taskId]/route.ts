import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH: Update a project item task item
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string; taskId: string }> }
) {
  const { itemId, taskId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { label, isDone } = body as { label?: string; isDone?: boolean };

  const task = await prisma.projectItemTaskItem.findFirst({
    where: { id: taskId, projectItemId: itemId },
  });
  if (!task) {
    return NextResponse.json({ error: "Task item not found" }, { status: 404 });
  }

  const updateData: { label?: string; isDone?: boolean } = {};
  if (label !== undefined) updateData.label = String(label).trim();
  if (isDone !== undefined) updateData.isDone = Boolean(isDone);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(task);
  }

  const updated = await prisma.projectItemTaskItem.update({
    where: { id: taskId },
    data: updateData,
  });
  return NextResponse.json(updated);
}

/**
 * DELETE: Remove a project item task item
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string; taskId: string }> }
) {
  const { itemId, taskId } = await params;
  const task = await prisma.projectItemTaskItem.findFirst({
    where: { id: taskId, projectItemId: itemId },
  });
  if (!task) {
    return NextResponse.json({ error: "Task item not found" }, { status: 404 });
  }
  await prisma.projectItemTaskItem.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
