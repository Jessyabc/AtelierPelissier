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
    const prev = proj.blockedReason;
    if (prev !== "missing_material") {
      await prisma.project.update({
        where: { id: projectId },
        data: { blockedReason: "missing_material" },
      });
      await logAudit(
        projectId,
        "material_shortage_blocked",
        prev ? JSON.stringify({ previousReason: prev }) : null
      );
    }
  } else if (proj.blockedReason === "missing_material") {
    await prisma.project.update({
      where: { id: projectId },
      data: { blockedReason: null },
    });
    await logAudit(projectId, "material_shortage_unblocked", null);
  }
}
