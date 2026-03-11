import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.supplierCatalogItem.findMany({
    include: {
      supplier: { select: { name: true } },
      inventoryItem: { select: { materialCode: true, description: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { supplierId, supplierSku, inventoryItemId, unitCost, leadTimeDays, isDefault } = body;

    if (!supplierId || !supplierSku || !inventoryItemId) {
      return NextResponse.json({ error: "supplierId, supplierSku, and inventoryItemId required" }, { status: 400 });
    }

    // If marking as default, un-default other entries for this material
    if (isDefault) {
      await prisma.supplierCatalogItem.updateMany({
        where: { inventoryItemId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const item = await prisma.supplierCatalogItem.create({
      data: {
        supplierId,
        supplierSku,
        inventoryItemId,
        unitCost: unitCost ?? 0,
        leadTimeDays: leadTimeDays ?? null,
        isDefault: isDefault ?? false,
      },
      include: {
        supplier: { select: { name: true } },
        inventoryItem: { select: { materialCode: true, description: true } },
      },
    });

    return NextResponse.json(item);
  } catch (err) {
    console.error("POST /api/supplier-catalog error:", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
