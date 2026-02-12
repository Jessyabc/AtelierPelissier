/**
 * Material requirement calculation: upsert MaterialRequirement from PanelParts.
 */

import { prisma } from "@/lib/db";
import { getEffectiveRiskSettings } from "@/lib/risk/getEffectiveRiskSettings";
import { computeRequiredQtyByMaterial } from "@/lib/materialRequirement";

export async function recalculateMaterialRequirements(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      panelParts: true,
      projectSettings: { include: { sheetFormat: true } },
    },
  });

  if (!project) return;

  const effectiveRisk = await getEffectiveRiskSettings(project.types || project.type, projectId);
  const sheetFormat = project.projectSettings?.sheetFormat;

  const requiredByMaterial = computeRequiredQtyByMaterial(
    project.panelParts.map((p) => ({
      materialCode: p.materialCode,
      lengthIn: p.lengthIn,
      widthIn: p.widthIn,
      qty: p.qty,
    })),
    sheetFormat ? { lengthIn: sheetFormat.lengthIn, widthIn: sheetFormat.widthIn } : null,
    effectiveRisk.wasteFactor
  );

  // allocatedQty = sum StockMovement where type in (allocate, consume), projectId matches
  const movements = await prisma.stockMovement.findMany({
    where: { projectId, type: { in: ["allocate", "consume"] } },
    include: { inventoryItem: true },
  });

  const allocatedByMaterial: Record<string, number> = {};
  for (const m of movements) {
    const code = m.inventoryItem.materialCode;
    if (!code) continue;
    allocatedByMaterial[code] = (allocatedByMaterial[code] ?? 0) + m.quantity;
  }

  const allMaterialCodes = new Set<string>([
    ...Object.keys(requiredByMaterial),
    ...Object.keys(allocatedByMaterial),
  ]);

  for (const materialCode of Array.from(allMaterialCodes)) {
    const requiredQty = requiredByMaterial[materialCode] ?? 0;
    const allocatedQty = allocatedByMaterial[materialCode] ?? 0;

    await prisma.materialRequirement.upsert({
      where: {
        projectId_materialCode: { projectId, materialCode },
      },
      create: {
        projectId,
        materialCode,
        requiredQty,
        allocatedQty,
      },
      update: {
        requiredQty,
        allocatedQty,
      },
    });
  }

  // Delete MaterialRequirements for materials no longer needed
  const toKeep = Array.from(new Set(Object.keys(requiredByMaterial)));
  if (toKeep.length === 0) {
    await prisma.materialRequirement.deleteMany({ where: { projectId } });
  } else {
    await prisma.materialRequirement.deleteMany({
      where: {
        projectId,
        materialCode: { notIn: toKeep },
      },
    });
  }
}
