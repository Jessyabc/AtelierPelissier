/**
 * Builds context payloads for the AI assistant based on scope.
 * Context is injected as a system message with each conversation turn.
 */

import { prisma } from "@/lib/db";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";

export type AiContextScope = {
  pathname: string;
  projectId?: string;
};

export async function buildContextMessage(scope: AiContextScope): Promise<string> {
  const parts: string[] = [];

  parts.push(`[Current page: ${scope.pathname}]`);
  parts.push(`[Time: ${new Date().toISOString()}]`);

  // Always include: deviation summary
  const deviations = await prisma.deviation.findMany({
    where: { resolved: false },
    include: { project: { select: { name: true, jobNumber: true } } },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  if (deviations.length > 0) {
    parts.push("\n--- Active Deviations ---");
    for (const d of deviations) {
      const proj = d.project ? `${d.project.jobNumber ?? d.project.name}` : "Global";
      parts.push(`- [${d.severity.toUpperCase()}] ${d.type}: ${d.message} (${proj})`);
    }
  }

  // Inventory: summary count + alerts only (full catalog available via getInventoryStatus tool)
  const invState = await computeInventoryState();
  const items = await prisma.inventoryItem.findMany({ orderBy: { materialCode: "asc" } });
  const itemMap = new Map(items.map((i) => [i.materialCode, i]));

  parts.push(`\n[Inventory: ${items.length} SKUs tracked. Use getInventoryStatus() for full details or to look up a specific material.]`);

  // Inventory alerts (items below threshold)
  const alerts = invState.filter((s) => {
    const item = itemMap.get(s.materialCode);
    return item && (s.availableQty < (item.minThreshold ?? 0) || s.availableQty < (item.reorderPoint ?? 0));
  });

  if (alerts.length > 0) {
    parts.push("\n--- Inventory Alerts (below threshold) ---");
    for (const a of alerts) {
      const item = itemMap.get(a.materialCode);
      parts.push(`- ${a.materialCode} (${item?.description ?? ""}): onHand=${a.onHand}, available=${a.availableQty}, incoming=${a.incomingQty}, minThreshold=${item?.minThreshold ?? 0}`);
    }
  }

  // Project-specific context when on a project page
  if (scope.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: scope.projectId },
      include: {
        client: true,
        costLines: true,
        projectSettings: true,
        materialRequirements: true,
        panelParts: { take: 50 },
        orders: { include: { lines: true, supplierRef: true } },
        deviations: { where: { resolved: false } },
      },
    });

    if (project) {
      parts.push("\n--- Current Project Context ---");
      parts.push(`Project: ${project.name}`);
      parts.push(`Job#: ${project.jobNumber ?? "N/A"}`);
      parts.push(`Type: ${project.types}`);
      parts.push(`Status: ${project.isDraft ? "Draft" : project.isDone ? "Done" : "Active"}`);
      parts.push(`Target: ${project.targetDate ? project.targetDate.toISOString().split("T")[0] : "Not set"}`);
      parts.push(`Production delay: ${project.productionDelayWeeks} weeks`);

      if (project.client) {
        parts.push(`Client: ${project.client.firstName} ${project.client.lastName}`);
      }

      const est = project.costLines.filter((l) => l.kind === "estimate").reduce((s, l) => s + l.amount, 0);
      const act = project.costLines.filter((l) => l.kind === "actual").reduce((s, l) => s + l.amount, 0);
      const markup = project.projectSettings?.markup ?? 2.5;
      parts.push(`Estimate cost: $${est.toFixed(2)}, Actual cost: $${act.toFixed(2)}, Markup: ${markup}x`);

      if (project.materialRequirements.length > 0) {
        parts.push("\nMaterial Requirements:");
        for (const mr of project.materialRequirements) {
          const state = invState.find((s) => s.materialCode === mr.materialCode);
          parts.push(`  - ${mr.materialCode}: required=${mr.requiredQty}, allocated=${mr.allocatedQty}, available=${state?.availableQty ?? "?"}, incoming=${state?.incomingQty ?? "?"}`);
        }
      }

      if (project.orders.length > 0) {
        parts.push("\nOrders:");
        for (const o of project.orders) {
          parts.push(`  - ${o.supplierRef?.name ?? o.supplier}: ${o.status}, ${o.lines.length} lines`);
        }
      }

      if (project.deviations.length > 0) {
        parts.push("\nProject Deviations:");
        for (const d of project.deviations) {
          parts.push(`  - [${d.severity.toUpperCase()}] ${d.type}: ${d.message}`);
        }
      }
    }
  }

  // Quick project summary + team status when not on a project page
  if (!scope.projectId) {
    const [activeProjects, employees, activePunches] = await Promise.all([
      prisma.project.findMany({
        where: { isDone: false, isDraft: false },
        select: {
          id: true,
          name: true,
          jobNumber: true,
          type: true,
          targetDate: true,
          _count: { select: { deviations: { where: { resolved: false } } } },
        },
        take: 15,
      }),
      prisma.employee.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true },
      }),
      prisma.punch.findMany({
        where: { punchOut: null },
        include: {
          employee: { select: { name: true } },
          station: { select: { name: true } },
        },
      }),
    ]);

    if (activeProjects.length > 0) {
      parts.push("\n--- Active Projects Summary ---");
      for (const p of activeProjects) {
        const issues = p._count.deviations;
        parts.push(`- ${p.jobNumber ?? p.name} (${p.type})${p.targetDate ? ` target: ${p.targetDate.toISOString().split("T")[0]}` : ""}${issues > 0 ? ` — ${issues} issue${issues !== 1 ? "s" : ""}` : ""}`);
      }
    }

    // Team snapshot
    parts.push(`\n--- Team Snapshot ---`);
    parts.push(`Total active employees: ${employees.length}`);
    if (activePunches.length > 0) {
      parts.push(`Currently clocked in (${activePunches.length}):`);
      for (const p of activePunches) {
        const since = p.punchIn ? `since ${p.punchIn.toISOString().replace("T", " ").slice(0, 16)}` : "";
        parts.push(`  - ${p.employee.name} @ ${p.station.name} ${since}`);
      }
    } else {
      parts.push("No one currently clocked in.");
    }
  }

  return parts.join("\n");
}
