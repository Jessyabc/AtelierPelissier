import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

/**
 * POST /api/ops/purchase-draft
 * Creates a draft Order with OrderLines from a shortage purchase request.
 *
 * Body: {
 *   supplierId: string,
 *   orderType: "order" | "reserve",
 *   projectId?: string,          // optional: tie order to a specific project
 *   expectedDeliveryDate?: string,
 *   items: { inventoryItemId: string, materialCode: string, quantity: number, unitCost: number, projectId?: string }[]
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { supplierId, orderType, projectId, expectedDeliveryDate, items } = body;

    if (!supplierId || !items?.length) {
      return NextResponse.json({ error: "supplierId and items required" }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const order = await prisma.order.create({
      data: {
        supplier: supplier.name,
        supplierId: supplier.id,
        status: "draft",
        orderType: orderType ?? "order",
        projectId: projectId ?? null,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        leadTimeDays: null,
        lines: {
          create: items.map((item: { inventoryItemId?: string; materialCode: string; quantity: number; unitCost: number; projectId?: string }) => ({
            inventoryItemId: item.inventoryItemId || undefined,
            materialCode: item.materialCode,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            projectId: item.projectId || undefined,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error("POST /api/ops/purchase-draft error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
