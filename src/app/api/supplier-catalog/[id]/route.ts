import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  const { id } = params;
  const body = await req.json();

  // If setting as default, un-default others for the same material
  if (body.isDefault === true) {
    const item = await prisma.supplierCatalogItem.findUnique({ where: { id } });
    if (item) {
      await prisma.supplierCatalogItem.updateMany({
        where: { inventoryItemId: item.inventoryItemId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
  }

  const updated = await prisma.supplierCatalogItem.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  await prisma.supplierCatalogItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
