import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  triggerMaterialInventoryOrderRecalc,
  triggerInventoryRecalcForMaterial,
} from "@/lib/observability/recalculateProjectState";

const createSchema = z.object({
  inventoryItemId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  orderLineId: z.string().optional().nullable(),
  type: z.enum(["allocate", "deallocate", "receive", "consume", "return", "adjust"]),
  quantity: z.number(),
  note: z.string().max(500).trim().optional().nullable(),
});

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
  const { inventoryItemId, projectId, orderLineId, type, quantity, note } = parsed.data;

  const inventoryItem = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
  });
  if (!inventoryItem) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  const movement = await prisma.stockMovement.create({
    data: {
      inventoryItemId,
      projectId: projectId ?? null,
      orderLineId: orderLineId ?? null,
      type,
      quantity,
      note: note ?? null,
    },
  });

  if (type === "receive" || type === "adjust") {
    const delta = type === "adjust" ? quantity : quantity;
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        onHand: { increment: delta },
        stockQty: { increment: delta },
      },
    });
  }

  if (projectId && (type === "allocate" || type === "consume" || type === "deallocate" || type === "return")) {
    triggerMaterialInventoryOrderRecalc(projectId);
  }
  triggerInventoryRecalcForMaterial(inventoryItem.materialCode);

  return NextResponse.json(movement);
}
