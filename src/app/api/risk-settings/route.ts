import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";

const updateSchema = z.object({
  targetMargin: z.number().min(0).max(1).optional(),
  warningMargin: z.number().min(0).max(1).optional(),
  highRiskMargin: z.number().min(0).max(1).optional(),
  criticalMargin: z.number().min(0).max(1).optional(),
  wasteFactor: z.number().min(1).max(2).optional(),
  inventoryShortageHigh: z.number().min(0).max(1).optional(),
});

export async function GET() {
  const settings = await prisma.globalRiskSettings.findFirst();
  if (!settings) {
    return NextResponse.json(null);
  }
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
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
  let settings;
  const existing = await prisma.globalRiskSettings.findFirst();
  if (existing) {
    settings = await prisma.globalRiskSettings.update({
      where: { id: existing.id },
      data: parsed.data,
    });
  } else {
    settings = await prisma.globalRiskSettings.create({
      data: parsed.data,
    });
  }

  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    recalculateProjectState(p.id).catch(() => {});
  }

  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  return POST(request);
}
