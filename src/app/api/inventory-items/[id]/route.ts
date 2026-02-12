import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerInventoryRecalcForMaterial } from "@/lib/observability/recalculateProjectState";

const updateSchema = z.object({
  materialCode: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  stockQty: z.number().min(0).optional(),
  onHand: z.number().min(0).optional(),
  unit: z.string().max(20).trim().optional(),
  minThreshold: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).optional(),
  reorderQty: z.number().min(0).optional(),
  costDefault: z.number().min(0).optional(),
  category: z.string().max(50).trim().optional(),
  defaultSheetFormatId: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: parsed.data,
  });
  triggerInventoryRecalcForMaterial(item.materialCode);
  return NextResponse.json(item);
}
