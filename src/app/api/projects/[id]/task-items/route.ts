import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET: List task items for a project (or sub-project)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = await prisma.projectTaskItem.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc", createdAt: "asc" },
  });
  return NextResponse.json(items);
}

/**
 * POST: Create a task item
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
  const label = typeof body === "object" && body !== null && "label" in body
    ? String((body as { label: string }).label || "Item").trim()
    : "Item";

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const maxOrder = await prisma.projectTaskItem.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const item = await prisma.projectTaskItem.create({
    data: { projectId, label, sortOrder },
  });
  return NextResponse.json(item);
}
