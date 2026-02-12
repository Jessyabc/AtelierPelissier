import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerSettingsRecalc } from "@/lib/observability/recalculateProjectState";

const updateSchema = z.object({
  targetMarginOverride: z.number().min(0).max(1).optional().nullable(),
  warningMarginOverride: z.number().min(0).max(1).optional().nullable(),
  highRiskMarginOverride: z.number().min(0).max(1).optional().nullable(),
  criticalMarginOverride: z.number().min(0).max(1).optional().nullable(),
  wasteFactorOverride: z.number().min(1).max(2).optional().nullable(),
  inventoryShortageHighOverride: z.number().min(0).max(1).optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
    include: { sheetFormat: true },
  });
  if (!settings) {
    return NextResponse.json({ error: "Project settings not found" }, { status: 404 });
  }
  return NextResponse.json(settings);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const settings = await prisma.projectSettings.upsert({
    where: { projectId },
    create: {
      projectId,
      ...parsed.data,
    },
    update: parsed.data,
    include: { sheetFormat: true },
  });
  triggerSettingsRecalc(projectId);
  return NextResponse.json(settings);
}
