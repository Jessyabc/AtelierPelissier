import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";

const createSchema = z.object({
  projectType: z.string().min(1).max(50).trim(),
  targetMargin: z.number().min(0).max(1).optional().nullable(),
  warningMargin: z.number().min(0).max(1).optional().nullable(),
  highRiskMargin: z.number().min(0).max(1).optional().nullable(),
  criticalMargin: z.number().min(0).max(1).optional().nullable(),
  wasteFactor: z.number().min(1).max(2).optional().nullable(),
  inventoryShortageHigh: z.number().min(0).max(1).optional().nullable(),
});

export async function GET() {
  const overrides = await prisma.projectTypeRiskOverride.findMany({
    orderBy: { projectType: "asc" },
  });
  return NextResponse.json(overrides);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const existing = await prisma.projectTypeRiskOverride.findFirst({
    where: { projectType: parsed.data.projectType },
  });
  const override = existing
    ? await prisma.projectTypeRiskOverride.update({
        where: { id: existing.id },
        data: {
          targetMargin: parsed.data.targetMargin,
          warningMargin: parsed.data.warningMargin,
          highRiskMargin: parsed.data.highRiskMargin,
          criticalMargin: parsed.data.criticalMargin,
          wasteFactor: parsed.data.wasteFactor,
          inventoryShortageHigh: parsed.data.inventoryShortageHigh,
        },
      })
    : await prisma.projectTypeRiskOverride.create({
        data: parsed.data,
      });

  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    recalculateProjectState(p.id).catch(() => {});
  }

  return NextResponse.json(override);
}
