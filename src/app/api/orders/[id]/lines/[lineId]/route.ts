import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  triggerOrderInventoryRecalc,
  triggerInventoryRecalcForMaterial,
} from "@/lib/observability/recalculateProjectState";

const updateSchema = z.object({
  receivedQty: z.number().min(0).optional(),
  qtyReceived: z.number().min(0).optional(), // Alias for receive action
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: orderId, lineId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const line = await prisma.orderLine.findFirst({
    where: { id: lineId, orderId },
    include: { order: true, inventoryItem: true },
  });
  if (!line) {
    return NextResponse.json({ error: "Order line not found" }, { status: 404 });
  }

  const qtyToReceive = parsed.data.qtyReceived ?? parsed.data.receivedQty ?? line.receivedQty;
  const delta = Math.max(0, qtyToReceive - line.receivedQty);

  if (delta > 0) {
    const materialCode = line.inventoryItem?.materialCode ?? line.materialCode;
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: { materialCode },
    });
    if (inventoryItem) {
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: inventoryItem.id,
          orderLineId: lineId,
          type: "receive",
          quantity: delta,
          note: `Received from order ${orderId}`,
        },
      });
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          onHand: { increment: delta },
          stockQty: { increment: delta },
        },
      });
      triggerInventoryRecalcForMaterial(materialCode);
    }
  }

  const updatedLine = await prisma.orderLine.update({
    where: { id: lineId },
    data: { receivedQty: qtyToReceive },
  });

  const allReceived = await prisma.orderLine.findMany({
    where: { orderId },
  });
  const allReceivedQty = allReceived.every((l) => l.receivedQty >= l.quantity);
  const someReceived = allReceived.some((l) => l.receivedQty > 0);
  if (allReceivedQty && line.order.status !== "received") {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "received" },
    });
  } else if (someReceived && line.order.status === "placed") {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "partial" },
    });
  }

  triggerOrderInventoryRecalc(line.order.projectId ?? null);

  return NextResponse.json(updatedLine);
}
