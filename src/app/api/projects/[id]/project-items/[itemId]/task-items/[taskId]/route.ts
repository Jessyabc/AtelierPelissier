import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

type Params = { id: string; itemId: string; taskId: string };

/**
 * PATCH: Update a project item task item. Admin/planner only
 * (production checklist editing).
 */
export const PATCH = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { itemId, taskId } = params;
    let body: unknown;
    try {
      body = await req.json();
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
);

/**
 * DELETE: Remove a project item task item. Admin/planner only.
 */
export const DELETE = withAuth<Params>(
  ["admin", "planner"],
  async ({ params }) => {
    const { itemId, taskId } = params;
    const task = await prisma.projectItemTaskItem.findFirst({
      where: { id: taskId, projectItemId: itemId },
    });
    if (!task) {
      return NextResponse.json({ error: "Task item not found" }, { status: 404 });
    }
    await prisma.projectItemTaskItem.delete({ where: { id: taskId } });
    return NextResponse.json({ ok: true });
  }
);
