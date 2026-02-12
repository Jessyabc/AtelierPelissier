/**
 * Risk resolution utility – merges GlobalSettings (Phase 2) or GlobalRiskSettings (Phase 1)
 * with ProjectTypeRiskOverride and ProjectSettings overrides.
 * No deviation logic may use hardcoded thresholds; all must come from this utility.
 */

import { prisma } from "@/lib/db";

export type EffectiveRiskSettings = {
  targetMargin: number;
  warningMargin: number;
  highRiskMargin: number;
  criticalMargin: number;
  wasteFactor: number;
  inventoryShortageHigh: number;
};

const DEFAULTS: EffectiveRiskSettings = {
  targetMargin: 0.25,
  warningMargin: 0.25,
  highRiskMargin: 0.18,
  criticalMargin: 0.12,
  wasteFactor: 1.15,
  inventoryShortageHigh: 0.2,
};

/**
 * Resolve effective risk settings for a project.
 * Priority: ProjectSettings overrides > ProjectTypeRiskOverride > GlobalSettings > GlobalRiskSettings > DEFAULTS.
 */
export async function getEffectiveRiskSettings(
  projectType: string,
  projectId?: string
): Promise<EffectiveRiskSettings> {
  const globalSettings = await prisma.globalSettings.findFirst();
  const globalRisk = await prisma.globalRiskSettings.findFirst();

  const base: EffectiveRiskSettings = globalSettings
    ? {
        targetMargin: globalSettings.targetMarginPct,
        warningMargin: globalSettings.warningMarginPct,
        highRiskMargin: globalSettings.highRiskMarginPct,
        criticalMargin: globalSettings.criticalMarginPct,
        wasteFactor: globalSettings.wasteFactor,
        inventoryShortageHigh: globalSettings.inventoryShortageHigh,
      }
    : globalRisk
      ? {
          targetMargin: globalRisk.targetMargin,
          warningMargin: globalRisk.warningMargin,
          highRiskMargin: globalRisk.highRiskMargin,
          criticalMargin: globalRisk.criticalMargin,
          wasteFactor: globalRisk.wasteFactor,
          inventoryShortageHigh: globalRisk.inventoryShortageHigh,
        }
      : { ...DEFAULTS };

  const primaryType = projectType.split(",")[0]?.trim() || projectType;
  const typeOverride = primaryType
    ? await prisma.projectTypeRiskOverride.findFirst({
        where: { projectType: primaryType },
      })
    : null;

  let merged: EffectiveRiskSettings = {
    targetMargin: typeOverride?.targetMargin ?? base.targetMargin,
    warningMargin: typeOverride?.warningMargin ?? base.warningMargin,
    highRiskMargin: typeOverride?.highRiskMargin ?? base.highRiskMargin,
    criticalMargin: typeOverride?.criticalMargin ?? base.criticalMargin,
    wasteFactor: typeOverride?.wasteFactor ?? base.wasteFactor,
    inventoryShortageHigh: typeOverride?.inventoryShortageHigh ?? base.inventoryShortageHigh,
  };

  if (projectId) {
    const projectSettings = await prisma.projectSettings.findUnique({
      where: { projectId },
    });
    if (projectSettings) {
      merged = {
        targetMargin: projectSettings.targetMarginOverride ?? merged.targetMargin,
        warningMargin: projectSettings.warningMarginOverride ?? merged.warningMargin,
        highRiskMargin: projectSettings.highRiskMarginOverride ?? merged.highRiskMargin,
        criticalMargin: projectSettings.criticalMarginOverride ?? merged.criticalMargin,
        wasteFactor: projectSettings.wasteFactorOverride ?? merged.wasteFactor,
        inventoryShortageHigh: projectSettings.inventoryShortageHighOverride ?? merged.inventoryShortageHigh,
      };
    }
  }

  return merged;
}
