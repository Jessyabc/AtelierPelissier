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

  // Always include: full inventory catalog (compact) so AI can resolve product names to codes
  const invState = await computeInventoryState();
  const items = await prisma.inventoryItem.findMany({ orderBy: { materialCode: "asc" } });
  const itemMap = new Map(items.map((i) => [i.materialCode, i]));

  if (items.length > 0) {
    parts.push("\n--- Inventory Catalog (materialCode → description | onHand) ---");
    const stateMap = new Map(invState.map((s) => [s.materialCode, s]));
    for (const item of items) {
      const s = stateMap.get(item.materialCode);
      const onHand = s?.onHand ?? item.onHand ?? 0;
      const available = s?.availableQty ?? onHand;
      parts.push(`${item.materialCode}: ${item.description} (${item.unit}) onHand=${onHand}, available=${available}`);
    }
  }

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

  // Quick project summary when not on a project page
  if (!scope.projectId) {
    const activeProjects = await prisma.project.findMany({
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
    });

    if (activeProjects.length > 0) {
      parts.push("\n--- Active Projects Summary ---");
      for (const p of activeProjects) {
        const issues = p._count.deviations;
        parts.push(`- ${p.jobNumber ?? p.name} (${p.type})${p.targetDate ? ` target: ${p.targetDate.toISOString().split("T")[0]}` : ""}${issues > 0 ? ` — ${issues} issue${issues !== 1 ? "s" : ""}` : ""}`);
      }
    }
  }

  return parts.join("\n");
}
