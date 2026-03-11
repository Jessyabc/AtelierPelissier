import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerInventoryRecalcForMaterial, triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";

/**
 * POST /api/ops/receive
 * Process receiving for order lines. Handles partial receives and deviation logging.
 *
 * Body: {
 *   orderId: string,
 *   lines: {
 *     orderLineId: string,
 *     receivedQty: number,
 *     reason?: string   // required if receivedQty != line.quantity
 *   }[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, lines } = body;

    if (!orderId || !lines?.length) {
      return NextResponse.json({ error: "orderId and lines required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { inventoryItem: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const results = [];
    const affectedMaterials = new Set<string>();

    for (const lineInput of lines) {
      const { orderLineId, receivedQty, reason } = lineInput;
      const orderLine = order.lines.find((l) => l.id === orderLineId);
      if (!orderLine) continue;

      const expectedQty = orderLine.quantity - orderLine.receivedQty;
      const actualReceived = Math.max(0, receivedQty);

      // Update OrderLine.receivedQty
      const newReceivedQty = orderLine.receivedQty + actualReceived;
      await prisma.orderLine.update({
        where: { id: orderLineId },
        data: { receivedQty: newReceivedQty },
      });

      // Create StockMovement for received qty
      if (actualReceived > 0 && orderLine.inventoryItemId) {
        await prisma.stockMovement.create({
          data: {
            inventoryItemId: orderLine.inventoryItemId,
            projectId: orderLine.projectId,
            orderLineId: orderLine.id,
            type: "receive",
            quantity: actualReceived,
            note: reason || null,
          },
        });

        // Update onHand
        await prisma.inventoryItem.update({
          where: { id: orderLine.inventoryItemId },
          data: { onHand: { increment: actualReceived } },
        });

        affectedMaterials.add(orderLine.materialCode);
      }

      // Log receiving deviation if qty differs
      const isDeviation = actualReceived !== expectedQty;
      let receivingDeviation = null;
      if (isDeviation) {
        // Build impact description
        const impact = await buildImpactDescription(orderLine.materialCode, expectedQty - actualReceived);

        receivingDeviation = await prisma.receivingDeviation.create({
          data: {
            orderLineId: orderLine.id,
            expectedQty,
            receivedQty: actualReceived,
            reason: reason || "No reason provided",
            impact,
          },
        });
      }

      results.push({
        orderLineId,
        expectedQty,
        actualReceived,
        isDeviation,
        receivingDeviation,
      });
    }

    // Update order status
    const updatedLines = await prisma.orderLine.findMany({
      where: { orderId },
    });

    const allReceived = updatedLines.every((l) => l.receivedQty >= l.quantity);
    const anyReceived = updatedLines.some((l) => l.receivedQty > 0);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: allReceived ? "received" : anyReceived ? "partial" : order.status,
      },
    });

    // Trigger recalculations for affected materials
    for (const code of Array.from(affectedMaterials)) {
      triggerInventoryRecalcForMaterial(code).catch(() => {});
    }
    if (order.projectId) {
      triggerOrderInventoryRecalc(order.projectId);
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("POST /api/ops/receive error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function buildImpactDescription(materialCode: string, shortfall: number): Promise<string> {
  if (shortfall <= 0) return "Received more than expected";

  const affectedReqs = await prisma.materialRequirement.findMany({
    where: { materialCode },
    include: { project: { select: { name: true, jobNumber: true } } },
  });

  if (affectedReqs.length === 0) return `Short ${shortfall} units of ${materialCode}`;

  const projectNames = affectedReqs.map(
    (r) => r.project.jobNumber ?? r.project.name
  );

  return `Short ${shortfall} units of ${materialCode}. Affects: ${projectNames.join(", ")}`;
}
