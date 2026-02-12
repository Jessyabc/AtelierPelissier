import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  defaultMarkup: z.number().min(1).max(10).optional(),
  targetMarginPct: z.number().min(0).max(1).optional(),
  warningMarginPct: z.number().min(0).max(1).optional(),
  highRiskMarginPct: z.number().min(0).max(1).optional(),
  criticalMarginPct: z.number().min(0).max(1).optional(),
  wasteFactor: z.number().min(1).max(2).optional(),
  inventoryShortageHigh: z.number().min(0).max(1).optional(),
  taxEnabledDefault: z.boolean().optional(),
  defaultTaxRate: z.number().min(0).max(1).optional(),
  defaultSheetFormatId: z.string().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  let settings = await prisma.globalSettings.findFirst();
  if (!settings) {
    settings = await prisma.globalSettings.create({
      data: {},
    });
  }
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
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

  let settings = await prisma.globalSettings.findFirst();
  if (!settings) {
    settings = await prisma.globalSettings.create({
      data: parsed.data,
    });
  } else {
    settings = await prisma.globalSettings.update({
      where: { id: settings.id },
      data: parsed.data,
    });
  }
  return NextResponse.json(settings);
}
