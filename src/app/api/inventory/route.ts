import { NextResponse } from "next/server";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { prisma } from "@/lib/db";

/**
 * GET: Inventory items with computed onHand, reserved, available.
 * Phase 2 dashboard endpoint.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [items, state] = await Promise.all([
    prisma.inventoryItem.findMany({
      orderBy: { materialCode: "asc" },
      include: { defaultSheetFormat: true },
    }),
    computeInventoryState(),
  ]);

  const stateByCode = Object.fromEntries(
    state.map((s) => [s.materialCode, s])
  );

  const enriched = items.map((item) => {
    const s = stateByCode[item.materialCode];
    return {
      ...item,
      onHand: s?.onHand ?? item.onHand ?? item.stockQty ?? 0,
      reservedQty: s?.reservedQty ?? 0,
      availableQty: s?.availableQty ?? 0,
      incomingQty: s?.incomingQty ?? 0,
      belowReorder: item.reorderPoint > 0 && (s?.onHand ?? item.onHand ?? 0) < item.reorderPoint,
      belowMin: (s?.onHand ?? item.onHand ?? 0) < item.minThreshold,
    };
  });

  return NextResponse.json(enriched);
}
