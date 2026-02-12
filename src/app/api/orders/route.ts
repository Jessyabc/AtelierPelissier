import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";

const createSchema = z.object({
  supplier: z.string().max(200).trim().optional(),
  supplierId: z.string().optional().nullable(),
  status: z.enum(["draft", "placed", "received", "partial", "cancelled"]).default("draft"),
  projectId: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const orders = await prisma.order.findMany({
    include: { lines: { include: { inventoryItem: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
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
  const data = parsed.data;
  let supplierName = data.supplier?.trim() ?? "";
  if (data.supplierId) {
    const sup = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (sup?.name) supplierName = sup.name;
  }
  if (!supplierName) supplierName = "Unknown";
  const order = await prisma.order.create({
    data: {
      supplier: supplierName,
      supplierId: data.supplierId ?? null,
      status: data.status ?? "draft",
      projectId: data.projectId ?? null,
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
    },
  });
  triggerOrderInventoryRecalc(order.projectId);
  return NextResponse.json(order);
}
