import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { panelPartUpdateSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const { id: projectId, partId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = panelPartUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const part = await prisma.panelPart.update({
    where: { id: partId },
    data: {
      ...(data.label != null && { label: data.label }),
      ...(data.lengthIn != null && { lengthIn: data.lengthIn }),
      ...(data.widthIn != null && { widthIn: data.widthIn }),
      ...(data.qty != null && { qty: data.qty }),
      ...(data.materialCode !== undefined && { materialCode: data.materialCode }),
      ...(data.thicknessIn !== undefined && { thicknessIn: data.thicknessIn }),
    },
  });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json(part);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  const { id: projectId, partId } = await params;
  await prisma.panelPart.delete({ where: { id: partId } });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json({ ok: true });
}
