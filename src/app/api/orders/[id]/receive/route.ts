import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";
import { triggerInventoryRecalcForMaterial } from "@/lib/observability/recalculateProjectState";

/**
 * POST /api/orders/[id]/receive
 * Receive an order (fully or partially). Updates OrderLine.receivedQty, creates
 * StockMovements, and advances the order status to "received" or "partial".
 *
 * Body: {
 *   lines?: Array<{ orderLineId: string; receivedQty: number }>,
 *   // If lines is omitted, receives all lines at their ordered quantity.
 * }
 */
export const dynamic = "force-dynamic";

const lineSchema = z.object({
  orderLineId: z.string(),
  receivedQty: z.number().min(0),
});

const receiveOrderSchema = z.object({
  lines: z.array(lineSchema).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = receiveOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { include: { inventoryItem: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "cancelled") {
    return NextResponse.json({ error: "Cannot receive a cancelled order" }, { status: 400 });
  }

  // Build a map of which lines to receive and how many
  const lineUpdates = new Map<string, number>();
  if (parsed.data.lines && parsed.data.lines.length > 0) {
    for (const l of parsed.data.lines) {
      lineUpdates.set(l.orderLineId, l.receivedQty);
    }
  } else {
    // Receive all lines at their full ordered quantity
    for (const l of order.lines) {
      lineUpdates.set(l.id, l.quantity);
    }
  }

  const materialCodesToRecalc: string[] = [];
  const movements: { orderLineId: string; qty: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      const receivedQty = lineUpdates.get(line.id);
      if (receivedQty === undefined || receivedQty <= 0) continue;

      const newReceivedQty = line.receivedQty + receivedQty;

      await tx.orderLine.update({
        where: { id: line.id },
        data: { receivedQty: newReceivedQty },
      });

      // Update inventory onHand if the line references an inventory item
      if (line.inventoryItemId) {
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            onHand: { increment: receivedQty },
            stockQty: { increment: receivedQty },
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            type: "receive",
            quantity: receivedQty,
            note: `Received via order ${order.id}`,
            orderLineId: line.id,
          },
        });

        if (!materialCodesToRecalc.includes(line.materialCode)) {
            materialCodesToRecalc.push(line.materialCode);
          }
        movements.push({ orderLineId: line.id, qty: receivedQty });
      }
    }

    // Determine new order status
    const updatedLines = await tx.orderLine.findMany({ where: { orderId: id } });
    const allReceived = updatedLines.every((l) => l.receivedQty >= l.quantity);
    const anyReceived = updatedLines.some((l) => l.receivedQty > 0);
    const newStatus = allReceived ? "received" : anyReceived ? "partial" : order.status;

    await tx.order.update({
      where: { id },
      data: { status: newStatus },
    });
  });

  // Fire-and-forget recalculations
  triggerOrderInventoryRecalc(order.projectId);
  for (const code of materialCodesToRecalc) {
    triggerInventoryRecalcForMaterial(code).catch(() => {});
  }

  return NextResponse.json({ status: "received", movements, orderId: id });
}
