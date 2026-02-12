import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [projects, deviations, inventoryItems, orders] = await Promise.all([
    prisma.project.findMany({
      include: {
        costLines: true,
        projectSettings: true,
        deviations: { where: { resolved: false } },
        materialRequirements: true,
        orders: { include: { lines: true } },
      },
    }),
    prisma.deviation.findMany({ where: { resolved: false } }),
    prisma.inventoryItem.findMany(),
    prisma.order.findMany({ where: { status: { not: "received" } }, include: { lines: true } }),
  ]);

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => !p.isDraft).length;
  const projectsWithDeviations = projects.filter((p) => p.deviations.length > 0).length;

  let avgMargin = 0;
  let totalCostVariance = 0;
  let projectsWithCosts = 0;

  for (const p of projects) {
    const est = p.costLines.filter((l) => l.kind === "estimate").reduce((s, l) => s + l.amount, 0);
    const act = p.costLines.filter((l) => l.kind === "actual").reduce((s, l) => s + l.amount, 0);
    const markup = p.projectSettings?.markup ?? 2.5;
    if (est > 0) {
      const recommended = est * markup;
      const margin = (recommended - act) / recommended;
      avgMargin += margin * 100;
      totalCostVariance += act - est;
      projectsWithCosts++;
    }
  }

  if (projectsWithCosts > 0) {
    avgMargin /= projectsWithCosts;
  }

  const inventoryBelowThreshold = inventoryItems.filter(
    (i) => i.stockQty < i.minThreshold
  ).length;

  const openOrders = orders.length;

  return NextResponse.json({
    totalProjects,
    activeProjects,
    projectsWithDeviations,
    avgMargin: Math.round(avgMargin * 100) / 100,
    totalCostVariance,
    inventoryBelowThreshold,
    openOrders,
    projects,
  });
}
