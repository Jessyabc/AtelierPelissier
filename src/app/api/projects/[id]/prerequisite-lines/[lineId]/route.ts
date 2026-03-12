import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { prerequisiteLineUpdateSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: projectId, lineId } = await params;
  const line = await prisma.prerequisiteLine.findFirst({
    where: { id: lineId, projectId },
  });
  if (!line) {
    return NextResponse.json({ error: "Prerequisite line not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = prerequisiteLineUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.prerequisiteLine.update({
    where: { id: lineId },
    data: {
      ...(parsed.data.materialCode !== undefined && { materialCode: parsed.data.materialCode }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      ...(parsed.data.quantity !== undefined && { quantity: parsed.data.quantity }),
      ...(parsed.data.needed !== undefined && { needed: parsed.data.needed }),
    },
  });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: projectId, lineId } = await params;
  const line = await prisma.prerequisiteLine.findFirst({
    where: { id: lineId, projectId },
  });
  if (!line) {
    return NextResponse.json({ error: "Prerequisite line not found" }, { status: 404 });
  }
  await prisma.prerequisiteLine.delete({ where: { id: lineId } });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json({ ok: true });
}
