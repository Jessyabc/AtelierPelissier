import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cutlistSchema } from "@/lib/validators";
import { requireProjectAccess } from "@/lib/auth/guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const projectItemId = searchParams.get("projectItemId");

  const where: { projectItem: { projectId: string; id?: string } } = {
    projectItem: { projectId },
  };
  if (projectItemId) {
    where.projectItem.id = projectItemId;
  }

  const cutlists = await prisma.cutlist.findMany({
    where,
    include: { projectItem: { select: { id: true, label: true, type: true } } },
    orderBy: [{ projectItem: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(cutlists);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = cutlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { projectItemId, name } = parsed.data;

  const projectItem = await prisma.projectItem.findFirst({
    where: { id: projectItemId, projectId },
  });
  if (!projectItem) {
    return NextResponse.json(
      { error: "Project item not found or does not belong to this project" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.cutlist
    .aggregate({
      where: { projectItemId },
      _max: { sortOrder: true },
    })
    .then((r) => r._max.sortOrder ?? -1);

  const cutlist = await prisma.cutlist.create({
    data: {
      projectItemId,
      name,
      sortOrder: maxOrder + 1,
    },
  });
  return NextResponse.json(cutlist);
}
