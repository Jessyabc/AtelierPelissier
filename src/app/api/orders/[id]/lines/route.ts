import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";

const createSchema = z.object({
  materialCode: z.string().min(1).max(100).trim(),
  inventoryItemId: z.string().optional().nullable(),
  quantity: z.number().min(0),
  receivedQty: z.number().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  projectId: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const data = parsed.data;
  const line = await prisma.orderLine.create({
    data: {
      orderId,
      materialCode: data.materialCode,
      inventoryItemId: data.inventoryItemId ?? null,
      quantity: data.quantity,
      receivedQty: data.receivedQty ?? 0,
      unitCost: data.unitCost ?? 0,
      projectId: data.projectId ?? null,
    },
  });
  triggerOrderInventoryRecalc(order.projectId);
  return NextResponse.json(line);
}
