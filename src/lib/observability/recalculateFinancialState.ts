/**
 * Financial detection: cost_overrun, margin_risk.
 * Uses effective risk settings for all thresholds.
 */

import { prisma } from "@/lib/db";
import { getEffectiveRiskSettings } from "@/lib/risk/getEffectiveRiskSettings";
import { upsertDeviation, resolveDeviation } from "./deviations";

export async function recalculateFinancialState(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      costLines: true,
      projectSettings: true,
    },
  });

  if (!project) return;

  const estimateLines = project.costLines.filter((l) => l.kind === "estimate");
  const actualLines = project.costLines.filter((l) => l.kind === "actual");

  const expectedCost = estimateLines.reduce((s, l) => s + l.amount, 0);
  const realCost = actualLines.reduce((s, l) => s + l.amount, 0);

  const markup = project.projectSettings?.markup ?? 2.5;
  const recommendedSalesPrice = expectedCost * markup;

  const effectiveRisk = await getEffectiveRiskSettings(project.types || project.type, projectId);

  // cost_overrun
  if (realCost > expectedCost) {
    const impactValue = realCost - expectedCost;
    await upsertDeviation({
      projectId,
      type: "cost_overrun",
      severity: "medium",
      groupKey: projectId,
      message: `Cost overrun: actual $${realCost.toFixed(2)} exceeds estimate $${expectedCost.toFixed(2)}`,
      impactValue,
    });
  } else {
    await resolveDeviation(projectId, "cost_overrun", projectId);
  }

  // margin_risk
  if (recommendedSalesPrice <= 0) return;

  const realMargin = (recommendedSalesPrice - realCost) / recommendedSalesPrice;

  if (realMargin < effectiveRisk.warningMargin) {
    let severity: string;
    if (realMargin < effectiveRisk.criticalMargin) {
      severity = "critical";
    } else if (realMargin < effectiveRisk.highRiskMargin) {
      severity = "high";
    } else {
      severity = "medium";
    }

    const impactValue = recommendedSalesPrice * (effectiveRisk.targetMargin - realMargin);

    await upsertDeviation({
      projectId,
      type: "margin_risk",
      severity,
      groupKey: "margin",
      message: `Margin risk: real margin ${(realMargin * 100).toFixed(1)}% below target ${(effectiveRisk.targetMargin * 100).toFixed(1)}%`,
      impactValue,
    });
  } else {
    await resolveDeviation(projectId, "margin_risk", "margin");
  }
}
