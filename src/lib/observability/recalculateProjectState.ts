/**
 * Recalculation orchestrator – calls all modules in order.
 * Fire-and-forget from API routes; errors are logged, not thrown.
 */

import { recalculateFinancialState } from "./recalculateFinancialState";
import { recalculateMaterialRequirements } from "./recalculateMaterialRequirements";
import { recalculateInventoryRisk } from "./recalculateInventoryRisk";
import { recalculateOrderRisk } from "./recalculateOrderRisk";

export async function recalculateProjectState(projectId: string): Promise<void> {
  try {
    await recalculateFinancialState(projectId);
    await recalculateMaterialRequirements(projectId);
    await recalculateInventoryRisk(projectId);
    await recalculateOrderRisk(projectId);
  } catch (err) {
    console.error(`recalculateProjectState(${projectId}) failed:`, err);
  }
}

/** Trigger only financial module (CostLine changes) */
export function triggerFinancialRecalc(projectId: string): void {
  recalculateFinancialState(projectId).catch((err) =>
    console.error(`triggerFinancialRecalc(${projectId}) failed:`, err)
  );
}

/** Trigger material + inventory + order (PanelPart changes) */
export function triggerMaterialInventoryOrderRecalc(projectId: string): void {
  Promise.all([
    recalculateMaterialRequirements(projectId),
    recalculateInventoryRisk(projectId),
    recalculateOrderRisk(projectId),
  ]).catch((err) =>
    console.error(`triggerMaterialInventoryOrderRecalc(${projectId}) failed:`, err)
  );
}

/** Trigger inventory only (InventoryItem, StockMovement) – for all projects using materialCode */
export async function triggerInventoryRecalcForMaterial(materialCode: string): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const reqs = await prisma.materialRequirement.findMany({
    where: { materialCode },
    select: { projectId: true },
  });
  const projectIds = Array.from(new Set(reqs.map((r) => r.projectId)));
  for (const projectId of projectIds) {
    recalculateInventoryRisk(projectId).catch((err) =>
      console.error(`recalculateInventoryRisk(${projectId}) failed:`, err)
    );
  }
}

/** Trigger order + inventory (Order changes) */
export function triggerOrderInventoryRecalc(projectId: string | null): void {
  const run = async () => {
    const { prisma } = await import("@/lib/db");
    if (projectId) {
      await recalculateOrderRisk(projectId);
      await recalculateInventoryRisk(projectId);
    } else {
      const reqs = await prisma.materialRequirement.findMany({ select: { projectId: true } });
      const projectIds = Array.from(new Set(reqs.map((r) => r.projectId)));
      for (const pid of projectIds) {
        await recalculateOrderRisk(pid);
        await recalculateInventoryRisk(pid);
      }
    }
  };
  run().catch((err) => console.error("triggerOrderInventoryRecalc failed:", err));
}

/** Trigger financial + material (Settings changes) */
export function triggerSettingsRecalc(projectId: string): void {
  Promise.all([
    recalculateFinancialState(projectId),
    recalculateMaterialRequirements(projectId),
  ]).catch((err) => console.error(`triggerSettingsRecalc(${projectId}) failed:`, err));
}
