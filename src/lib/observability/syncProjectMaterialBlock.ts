/**
 * P1-006: Sync `Project.blockedReason` with severe inventory_shortage deviations.
 * Call after inventory risk recalculation; avoids import cycles in deviations.ts.
 */

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function syncProjectBlockedFromMaterialShortage(projectId: string): Promise<void> {
  const severeCount = await prisma.deviation.count({
    where: {
      projectId,
      type: "inventory_shortage",
      resolved: false,
      severity: { in: ["high", "critical"] },
    },
  });

  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { blockedReason: true },
  });
  if (!proj) return;

  if (severeCount > 0) {
    // B-11: Only auto-set if no reason is set or it's already missing_material.
    // Don't overwrite manually-set reasons (waiting_approval, supplier_delay, etc.).
    if (!proj.blockedReason) {
      await prisma.project.update({
        where: { id: projectId },
        data: { blockedReason: "missing_material" },
      });
      await logAudit(projectId, "material_shortage_blocked", null);
    }
  } else if (proj.blockedReason === "missing_material") {
    await prisma.project.update({
      where: { id: projectId },
      data: { blockedReason: null },
    });
    await logAudit(projectId, "material_shortage_unblocked", null);
  }
}
