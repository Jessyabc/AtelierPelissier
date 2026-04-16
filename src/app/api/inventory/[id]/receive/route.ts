import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerInventoryRecalcForMaterial } from "@/lib/observability/recalculateProjectState";
import { requireRole } from "@/lib/auth/session";

/**
 * POST /api/inventory/[id]/receive
 * Receive stock for an inventory item. Creates a StockMovement and updates onHand.
 *
 * Body: { quantity, note?, orderId? }
 */
export const dynamic = "force-dynamic";

const receiveSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  note: z.string().max(500).trim().optional(),
  orderId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = receiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  const { quantity, note, orderId } = parsed.data;

  // Create movement and update onHand in a transaction
  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        inventoryItemId: id,
        type: "receive",
        quantity,
        note: note ?? null,
        orderLineId: orderId ?? null,
      },
    }),
    prisma.inventoryItem.update({
      where: { id },
      data: { onHand: { increment: quantity }, stockQty: { increment: quantity } },
    }),
  ]);

  // Fire-and-forget recalculation for all projects using this material
  triggerInventoryRecalcForMaterial(item.materialCode).catch(() => {});

  return NextResponse.json({ movement, newOnHand: item.onHand + quantity });
}
