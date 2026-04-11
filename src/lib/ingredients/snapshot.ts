/**
 * Material Snapshot persistence layer.
 *
 * The saved snapshot IS the project's operational material truth.
 * - saveSnapshot: writes PanelParts + PrerequisiteLines, creates/supersedes snapshot
 * - markSnapshotStale: called when ingredient-driving config changes
 * - getActiveSnapshot: retrieves current material reference for a project+sourceType
 *
 * Downstream systems (shortage, inventory, purchasing) read the saved snapshot,
 * NOT the live estimate. This is the bridge between "what is configured" and
 * "what the project is committed to materially."
 */

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { IngredientEstimate, EstimatedPanel, EstimatedHardware } from "./types";

export type SnapshotSourceType = "vanity" | "side_unit";

/**
 * Save a material snapshot for a project, persisting panels + hardware as
 * PanelPart and PrerequisiteLine rows. Supersedes any existing active snapshot.
 *
 * PROJECT LIFECYCLE NOTES:
 * - Draft (isDraft=true): free save, stale tracking active but non-blocking
 * - Real project (isDraft=false, isDone=false): full stale tracking + warning
 * - Done project (isDone=true): save still works but downstream should flag this
 */
export async function saveSnapshot(
  projectId: string,
  sourceType: SnapshotSourceType,
  estimate: IngredientEstimate,
  configHash: string,
  userId?: string
): Promise<{ snapshotId: string }> {
  // 1. Deactivate any existing active snapshot for this project+sourceType
  await prisma.materialSnapshot.updateMany({
    where: { projectId, sourceType, isActive: true },
    data: { isActive: false },
  });

  // 2. Delete existing auto-generated PanelParts and PrerequisiteLines
  //    (we recreate them from the new estimate)
  await prisma.panelPart.deleteMany({ where: { projectId } });
  await prisma.prerequisiteLine.deleteMany({ where: { projectId } });

  // 3. Write PanelPart rows from panels
  const panelData = estimate.panels.map((p: EstimatedPanel) => ({
    projectId,
    label: p.label,
    lengthIn: p.lengthIn,
    widthIn: p.widthIn,
    qty: p.qty,
    materialCode: p.materialCode,
    thicknessIn: p.thicknessIn,
  }));

  if (panelData.length > 0) {
    await prisma.panelPart.createMany({ data: panelData });
  }

  // 4. Write PrerequisiteLine rows from hardware
  const hwData = estimate.hardware.map((h: EstimatedHardware, i: number) => ({
    projectId,
    materialCode: h.materialCode,
    category: h.category,
    quantity: h.quantity,
    needed: true,
    sortOrder: i,
  }));

  if (hwData.length > 0) {
    await prisma.prerequisiteLine.createMany({ data: hwData });
  }

  // 5. Create new active snapshot
  const snapshot = await prisma.materialSnapshot.create({
    data: {
      projectId,
      sourceType,
      configHash,
      isActive: true,
      isStale: false,
      savedByUserId: userId ?? null,
      panelCount: estimate.totalPanelCount,
      hardwareCount: estimate.totalHardwareItems,
      sheetCount: estimate.sheetEstimates.reduce(
        (sum, s) => sum + s.sheetsNeeded,
        0
      ),
      frontCount: estimate.metrics.frontCount,
      drawerCount: estimate.metrics.drawerCount,
      hingeCount: estimate.metrics.hingeCount,
      dividerCount: estimate.metrics.dividerCount,
      complexityScore: estimate.metrics.complexityScore,
    },
  });

  // 6. Audit
  await logAudit(
    projectId,
    "saved" as Parameters<typeof logAudit>[1],
    JSON.stringify({
      details: `Material snapshot saved (${sourceType})`,
      snapshotId: snapshot.id,
      panelCount: estimate.totalPanelCount,
      hardwareCount: estimate.totalHardwareItems,
    })
  );

  return { snapshotId: snapshot.id };
}

/**
 * Mark the active snapshot as stale because ingredient-driving config changed.
 * Called from vanity/side-unit PATCH routes after detecting configHash mismatch.
 */
export async function markSnapshotStale(
  projectId: string,
  sourceType: SnapshotSourceType
): Promise<void> {
  const updated = await prisma.materialSnapshot.updateMany({
    where: { projectId, sourceType, isActive: true, isStale: false },
    data: { isStale: true },
  });

  if (updated.count > 0) {
    await logAudit(
      projectId,
      "saved" as Parameters<typeof logAudit>[1],
      JSON.stringify({
        details: `Material snapshot marked stale (${sourceType}) — config changed`,
      })
    );
  }
}

/**
 * Get the active snapshot for a project + source type.
 * Returns null if no snapshot has been saved yet.
 */
export async function getActiveSnapshot(
  projectId: string,
  sourceType: SnapshotSourceType
) {
  return prisma.materialSnapshot.findFirst({
    where: { projectId, sourceType, isActive: true },
    orderBy: { savedAt: "desc" },
  });
}
