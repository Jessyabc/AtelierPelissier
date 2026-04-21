import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

type Params = { id: string; itemId: string };

/**
 * PATCH: Update a task item (label, isDone). Admin/planner only.
 * Follow-up: let woodworkers flip `isDone` on their own assigned tasks.
 */
export const PATCH = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id: projectId, itemId } = params;
    let body: unknown;
    try {
      body = await req.json();
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
);

/**
 * DELETE: Remove a task item. Admin/planner only.
 */
export const DELETE = withAuth<Params>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId, itemId } = params;
    const item = await prisma.projectTaskItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!item) {
      return NextResponse.json({ error: "Task item not found" }, { status: 404 });
    }
    await prisma.projectTaskItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  }
);
