import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; itemId: string };

/**
 * GET: Get a single project item. Any authenticated user.
 */
export const GET = withAuth<Params>("any", async ({ params }) => {
  const { id: projectId, itemId } = params;
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
});

/**
 * PATCH: Update a project item. Sales-touchable (room rename, process swap
 * during quote configuration).
 */
export const PATCH = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
    const { id: projectId, itemId } = params;
    let body: unknown;
    try {
      body = await req.json();
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
);

/**
 * DELETE: Remove a project item. Sales-touchable — they created it.
 */
export const DELETE = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ params }) => {
    const { id: projectId, itemId } = params;
    const item = await prisma.projectItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!item) {
      return NextResponse.json({ error: "Project item not found" }, { status: 404 });
    }
    await prisma.projectItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  }
);
