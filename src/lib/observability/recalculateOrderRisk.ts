/**
 * Order delay: requiredQty > allocatedQty with no OrderLine for that materialCode.
 */

import { prisma } from "@/lib/db";
import { upsertDeviation, resolveDeviation } from "./deviations";

export async function recalculateOrderRisk(projectId: string): Promise<void> {
  const requirements = await prisma.materialRequirement.findMany({
    where: { projectId },
  });

  // All OrderLines by materialCode (any order)
  const orderLinesByMaterial = await prisma.orderLine.findMany();
  const hasOrderForMaterial = new Set<string>();
  for (const ol of orderLinesByMaterial) {
    hasOrderForMaterial.add(ol.materialCode);
  }

  const materialCodesWithDelay = new Set<string>();
  for (const mr of requirements) {
    if (mr.requiredQty <= mr.allocatedQty || hasOrderForMaterial.has(mr.materialCode)) continue;

    materialCodesWithDelay.add(mr.materialCode);
    const impactValue = mr.requiredQty - mr.allocatedQty;

    await upsertDeviation({
      projectId,
      type: "order_delay",
      severity: "medium",
      groupKey: mr.materialCode,
      message: `No order for ${mr.materialCode}: need ${mr.requiredQty.toFixed(1)}, allocated ${mr.allocatedQty.toFixed(1)}`,
      impactValue,
    });
  }

  // Resolve order_delay for materials that no longer have a delay
  const allOrderDelays = await prisma.deviation.findMany({
    where: { projectId, type: "order_delay", resolved: false },
  });
  for (const d of allOrderDelays) {
    if (d.groupKey && !materialCodesWithDelay.has(d.groupKey)) {
      await resolveDeviation(projectId, "order_delay", d.groupKey);
    }
  }
}
