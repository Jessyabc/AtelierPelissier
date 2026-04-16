import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { panelPartSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";
import { requireProjectAccess } from "@/lib/auth/guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const cutlistId = searchParams.get("cutlistId");
  const projectItemId = searchParams.get("projectItemId");

  const where: Record<string, unknown> = { projectId };
  if (cutlistId) {
    where.cutlistId = cutlistId;
  } else if (projectItemId) {
    where.cutlist = { projectItemId };
  }

  const parts = await prisma.panelPart.findMany({
    where: where as { projectId: string; cutlistId?: string; cutlist?: { projectItemId: string } },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(parts);
}

/** DELETE parts: all for project (no query), or only project-level (?cutlistId=null), or only one cutlist (?cutlistId=<cuid>) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  const { searchParams } = new URL(request.url);
  const cutlistIdParam = searchParams.get("cutlistId");
  const where: { projectId: string; cutlistId?: string | null } = { projectId };
  if (cutlistIdParam !== null && cutlistIdParam !== undefined) {
    if (cutlistIdParam === "" || cutlistIdParam === "null") where.cutlistId = null;
    else where.cutlistId = cutlistIdParam;
  }
  await prisma.panelPart.deleteMany({ where });
  return NextResponse.json({ ok: true });
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
  const parsed = panelPartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.cutlistId != null) {
    const cutlistRepo = (prisma as unknown as { cutlist: { findFirst: (args: { where: { id: string }; include: { projectItem: { select: { projectId: true } } } }) => Promise<{ projectItem: { projectId: string } } | null> } }).cutlist;
    const cutlistWithProject = await cutlistRepo.findFirst({
      where: { id: data.cutlistId },
      include: { projectItem: { select: { projectId: true } } },
    });
    if (!cutlistWithProject || cutlistWithProject.projectItem.projectId !== projectId) {
      return NextResponse.json(
        { error: "Cutlist not found or does not belong to this project" },
        { status: 400 }
      );
    }
  }

  const part = await prisma.panelPart.create({
    data: {
      projectId,
      label: data.label,
      lengthIn: data.lengthIn,
      widthIn: data.widthIn,
      qty: data.qty,
      materialCode: data.materialCode ?? null,
      thicknessIn: data.thicknessIn ?? null,
      ...(data.cutlistId != null && { cutlistId: data.cutlistId }),
    },
  });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json(part);
}
