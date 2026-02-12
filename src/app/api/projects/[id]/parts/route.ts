import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { panelPartSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const parts = await prisma.panelPart.findMany({
    where: { projectId },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(parts);
}

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
  const parsed = panelPartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const part = await prisma.panelPart.create({
    data: {
      projectId,
      label: data.label,
      lengthIn: data.lengthIn,
      widthIn: data.widthIn,
      qty: data.qty,
      materialCode: data.materialCode ?? null,
      thicknessIn: data.thicknessIn ?? null,
    },
  });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json(part);
}
