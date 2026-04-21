import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

type Params = { id: string; itemId: string };

/**
 * GET: List task items for a project item. Any authenticated user.
 */
export const GET = withAuth<Params>("any", async ({ params }) => {
  const { itemId } = params;
  const item = await prisma.projectItem.findUnique({
    where: { id: itemId },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Project item not found" }, { status: 404 });
  }
  const items = await prisma.projectItemTaskItem.findMany({
    where: { projectItemId: itemId },
    orderBy: { sortOrder: "asc", createdAt: "asc" },
  });
  return NextResponse.json(items);
});

/**
 * POST: Create a task item for a project item. Admin/planner only
 * (production checklist editing).
 */
export const POST = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { itemId } = params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const label = typeof body === "object" && body !== null && "label" in body
      ? String((body as { label: string }).label || "Step").trim()
      : "Step";

    const item = await prisma.projectItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Project item not found" }, { status: 404 });
    }

    const maxOrder = await prisma.projectItemTaskItem.aggregate({
      where: { projectItemId: itemId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const taskItem = await prisma.projectItemTaskItem.create({
      data: { projectItemId: itemId, label, sortOrder },
    });
    return NextResponse.json(taskItem);
  }
);
