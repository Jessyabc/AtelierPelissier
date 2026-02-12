/**
 * Phase 2: Compute reserved and available quantities per InventoryItem.
 * reservedQty = sum(StockMovement.qty) where type in (allocate, consume)
 *             − sum(StockMovement.qty) where type in (deallocate, return)
 * availableQty = onHand − reservedQty
 *
 * This module is used by recalculateInventoryRisk and by inventory dashboards.
 * It does NOT write to DB; it returns computed values for callers to use.
 */

import { prisma } from "@/lib/db";

export type InventoryStateItem = {
  inventoryItemId: string;
  materialCode: string;
  onHand: number;
  reservedQty: number;
  availableQty: number;
  incomingQty: number; // from open orders
};

/**
 * Compute inventory state for all items or a subset.
 * Uses onHand (Phase 2) or stockQty (Phase 1 fallback).
 */
export async function computeInventoryState(
  materialCodes?: string[]
): Promise<InventoryStateItem[]> {
  const items = await prisma.inventoryItem.findMany({
    where: materialCodes?.length ? { materialCode: { in: materialCodes } } : undefined,
    include: { movements: true },
  });

  const result: InventoryStateItem[] = [];

  for (const item of items) {
    const onHand = item.onHand ?? item.stockQty ?? 0;

    let reservedQty = 0;
    for (const m of item.movements) {
      if (m.type === "allocate" || m.type === "consume") {
        reservedQty += m.quantity;
      } else if (m.type === "deallocate" || m.type === "return") {
        reservedQty -= m.quantity;
      }
    }
    reservedQty = Math.max(0, reservedQty);

    const availableQty = Math.max(0, onHand - reservedQty);

    result.push({
      inventoryItemId: item.id,
      materialCode: item.materialCode,
      onHand,
      reservedQty,
      availableQty,
      incomingQty: 0, // Filled below
    });
  }

  if (result.length === 0) return result;

  const codes = result.map((r) => r.materialCode);
  const placedOrders = await prisma.order.findMany({
    where: { status: { in: ["placed", "partial"] } },
    include: { lines: { include: { inventoryItem: true } } },
  });

  const incomingByMaterial: Record<string, number> = {};
  for (const order of placedOrders) {
    for (const line of order.lines) {
      const code = line.inventoryItem?.materialCode ?? line.materialCode;
      if (!code || !codes.includes(code)) continue;
      const qty = line.quantity - line.receivedQty;
      if (qty > 0) {
        incomingByMaterial[code] = (incomingByMaterial[code] ?? 0) + qty;
      }
    }
  }

  for (const r of result) {
    r.incomingQty = incomingByMaterial[r.materialCode] ?? 0;
  }

  return result;
}
