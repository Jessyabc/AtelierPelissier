import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateCutlistSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cutlistId: string }> }
) {
  const { id: projectId, cutlistId } = await params;
  const cutlist = await prisma.cutlist.findFirst({
    where: { id: cutlistId },
    include: { projectItem: { select: { projectId: true } } },
  });
  if (!cutlist || cutlist.projectItem.projectId !== projectId) {
    return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateCutlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.cutlist.update({
    where: { id: cutlistId },
    data: {
      ...(parsed.data.name != null && { name: parsed.data.name }),
      ...(parsed.data.sortOrder != null && { sortOrder: parsed.data.sortOrder }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cutlistId: string }> }
) {
  const { id: projectId, cutlistId } = await params;
  const cutlist = await prisma.cutlist.findFirst({
    where: { id: cutlistId },
    include: { projectItem: { select: { projectId: true } } },
  });
  if (!cutlist || cutlist.projectItem.projectId !== projectId) {
    return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
  }

  await prisma.panelPart.updateMany({
    where: { cutlistId },
    data: { cutlistId: null },
  });
  await prisma.cutlist.delete({ where: { id: cutlistId } });
  return NextResponse.json({ ok: true });
}
