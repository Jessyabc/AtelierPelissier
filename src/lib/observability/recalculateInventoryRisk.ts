/**
 * Inventory risk: inventory_shortage when requiredQty > availableStock.
 * Phase 2: Uses computeInventoryState for onHand, reserved, available.
 * availableStock = availableQty + incomingOrders (from recalculateInventoryState)
 */

import { prisma } from "@/lib/db";
import { getEffectiveRiskSettings } from "@/lib/risk/getEffectiveRiskSettings";
import { upsertDeviation, resolveDeviation } from "./deviations";
import { computeInventoryState } from "./recalculateInventoryState";

export async function recalculateInventoryRisk(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { materialRequirements: true },
  });

  if (!project || project.materialRequirements.length === 0) {
    await prisma.deviation.updateMany({
      where: { projectId, type: "inventory_shortage", resolved: false },
      data: { resolved: true },
    });
    return;
  }

  const effectiveRisk = await getEffectiveRiskSettings(project.types || project.type, projectId);

  const materialCodes = project.materialRequirements.map((r) => r.materialCode);
  const inventoryState = await computeInventoryState(materialCodes);
  const availableByMaterial: Record<string, number> = {};
  const incomingByMaterial: Record<string, number> = {};
  for (const s of inventoryState) {
    availableByMaterial[s.materialCode] = s.availableQty;
    incomingByMaterial[s.materialCode] = s.incomingQty;
  }

  for (const mr of project.materialRequirements) {
    const requiredQty = mr.requiredQty;
    if (requiredQty <= 0) continue;

    const availableStock = (availableByMaterial[mr.materialCode] ?? 0) + (incomingByMaterial[mr.materialCode] ?? 0);

    if (requiredQty > availableStock) {
      const shortage = requiredQty - availableStock;
      const shortagePercent = shortage / requiredQty;
      const severity =
        shortagePercent >= effectiveRisk.inventoryShortageHigh ? "high" : "medium";
      const impactValue = shortage;

      await upsertDeviation({
        projectId,
        type: "inventory_shortage",
        severity,
        groupKey: mr.materialCode,
        message: `Shortage: need ${requiredQty.toFixed(1)} ${mr.materialCode}, available ${availableStock.toFixed(1)}`,
        impactValue,
      });
    } else {
      await resolveDeviation(projectId, "inventory_shortage", mr.materialCode);
    }
  }
}
