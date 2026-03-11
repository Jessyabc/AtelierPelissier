/**
 * Resolves the default supplier for a given inventory material.
 *
 * Priority:
 *   1. SupplierCatalogItem with isDefault = true
 *   2. Any SupplierCatalogItem (first by createdAt)
 *   3. Richelieu fallback — looks up by name pattern
 */

import { prisma } from "@/lib/db";

export type ResolvedSupplier = {
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  supplierSku: string;
  unitCost: number;
  leadTimeDays: number | null;
};

export async function resolveDefaultSupplier(
  inventoryItemId: string
): Promise<ResolvedSupplier | null> {
  const defaultItem = await prisma.supplierCatalogItem.findFirst({
    where: { inventoryItemId, isDefault: true },
    include: { supplier: true },
  });

  if (defaultItem) {
    return {
      supplierId: defaultItem.supplierId,
      supplierName: defaultItem.supplier.name,
      supplierEmail: defaultItem.supplier.email,
      supplierSku: defaultItem.supplierSku,
      unitCost: defaultItem.unitCost,
      leadTimeDays: defaultItem.leadTimeDays,
    };
  }

  const anyItem = await prisma.supplierCatalogItem.findFirst({
    where: { inventoryItemId },
    include: { supplier: true },
    orderBy: { createdAt: "asc" },
  });

  if (anyItem) {
    return {
      supplierId: anyItem.supplierId,
      supplierName: anyItem.supplier.name,
      supplierEmail: anyItem.supplier.email,
      supplierSku: anyItem.supplierSku,
      unitCost: anyItem.unitCost,
      leadTimeDays: anyItem.leadTimeDays,
    };
  }

  // Richelieu fallback
  const richelieu = await prisma.supplier.findFirst({
    where: { name: { contains: "Richelieu" } },
  });

  if (richelieu) {
    return {
      supplierId: richelieu.id,
      supplierName: richelieu.name,
      supplierEmail: richelieu.email,
      unitCost: 0,
      supplierSku: "",
      leadTimeDays: null,
    };
  }

  return null;
}

/**
 * Batch-resolve default suppliers for multiple inventory items.
 * Returns a map of inventoryItemId -> ResolvedSupplier.
 */
export async function resolveDefaultSuppliers(
  inventoryItemIds: string[]
): Promise<Map<string, ResolvedSupplier>> {
  const result = new Map<string, ResolvedSupplier>();
  if (inventoryItemIds.length === 0) return result;

  const catalogItems = await prisma.supplierCatalogItem.findMany({
    where: { inventoryItemId: { in: inventoryItemIds } },
    include: { supplier: true },
    orderBy: { createdAt: "asc" },
  });

  const byItem = new Map<string, typeof catalogItems>();
  for (const ci of catalogItems) {
    const list = byItem.get(ci.inventoryItemId) ?? [];
    list.push(ci);
    byItem.set(ci.inventoryItemId, list);
  }

  // Lazy-loaded Richelieu fallback
  let richelieu: { id: string; name: string; email: string | null } | null | undefined;

  for (const itemId of inventoryItemIds) {
    const candidates = byItem.get(itemId) ?? [];
    const defaultCandidate = candidates.find((c) => c.isDefault);
    const chosen = defaultCandidate ?? candidates[0];

    if (chosen) {
      result.set(itemId, {
        supplierId: chosen.supplierId,
        supplierName: chosen.supplier.name,
        supplierEmail: chosen.supplier.email,
        supplierSku: chosen.supplierSku,
        unitCost: chosen.unitCost,
        leadTimeDays: chosen.leadTimeDays,
      });
    } else {
      if (richelieu === undefined) {
        richelieu = await prisma.supplier.findFirst({
          where: { name: { contains: "Richelieu" } },
          select: { id: true, name: true, email: true },
        });
      }
      if (richelieu) {
        result.set(itemId, {
          supplierId: richelieu.id,
          supplierName: richelieu.name,
          supplierEmail: richelieu.email,
          supplierSku: "",
          unitCost: 0,
          leadTimeDays: null,
        });
      }
    }
  }

  return result;
}
