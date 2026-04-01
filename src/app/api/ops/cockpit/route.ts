import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { resolveDefaultSuppliers } from "@/lib/purchasing/resolveDefaultSupplier";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    projects,
    deviations,
    orders,
    inventoryItems,
    inventoryState,
    materialReqs,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { isDone: false },
      include: {
        costLines: true,
        projectSettings: true,
        deviations: { where: { resolved: false } },
        materialRequirements: true,
        client: true,
        orders: {
          include: {
            lines: { include: { inventoryItem: true } },
            supplierRef: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deviation.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { status: { in: ["draft", "placed", "partial"] } },
      include: {
        lines: { include: { inventoryItem: true, receivingDeviations: true } },
        supplierRef: true,
        project: { select: { id: true, name: true, jobNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventoryItem.findMany(),
    computeInventoryState(),
    prisma.materialRequirement.findMany({
      include: { project: { select: { id: true, name: true, jobNumber: true, targetDate: true, productionDelayWeeks: true } } },
    }),
  ]);

  // Build inventory lookup
  const invStateMap = new Map(inventoryState.map((s) => [s.materialCode, s]));
  const invItemMap = new Map(inventoryItems.map((i) => [i.materialCode, i]));

  // --- Project Health ---
  const projectHealth = projects.map((p) => {
    const est = p.costLines.filter((l) => l.kind === "estimate").reduce((s, l) => s + l.amount, 0);
    const act = p.costLines.filter((l) => l.kind === "actual").reduce((s, l) => s + l.amount, 0);
    const markup = p.projectSettings?.markup ?? 2.5;
    const recommended = est * markup;
    const margin = recommended > 0 ? ((recommended - act) / recommended) * 100 : 0;

    const totalRequired = p.materialRequirements.reduce((s, r) => s + r.requiredQty, 0);
    const totalAllocated = p.materialRequirements.reduce((s, r) => s + r.allocatedQty, 0);
    const fulfillmentPct = totalRequired > 0 ? Math.round((totalAllocated / totalRequired) * 100) : 100;

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const worstDeviation = p.deviations.length > 0
      ? p.deviations.sort(
          (a, b) =>
            (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
            (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
        )[0].severity
      : null;

    return {
      id: p.id,
      name: p.name,
      jobNumber: p.jobNumber,
      type: p.type,
      isDraft: p.isDraft,
      targetDate: p.targetDate,
      productionDelayWeeks: p.productionDelayWeeks,
      clientName: p.client
        ? `${p.client.firstName} ${p.client.lastName}`
        : p.clientFirstName
          ? `${p.clientFirstName} ${p.clientLastName ?? ""}`.trim()
          : null,
      deviationCount: p.deviations.length,
      worstSeverity: worstDeviation,
      fulfillmentPct,
      margin: Math.round(margin * 100) / 100,
      estimateCost: est,
      actualCost: act,
      blockedReason: p.blockedReason ?? null,
    };
  });

  // --- Shortages grouped by supplier ---
  const shortageItems: {
    materialCode: string;
    inventoryItemId: string;
    description: string;
    shortageQty: number;
    requiredQty: number;
    availableQty: number;
    incomingQty: number;
    projects: { id: string; name: string; jobNumber: string | null; requiredQty: number }[];
  }[] = [];

  // Group material requirements by materialCode
  const reqsByMaterial = new Map<string, typeof materialReqs>();
  for (const mr of materialReqs) {
    const list = reqsByMaterial.get(mr.materialCode) ?? [];
    list.push(mr);
    reqsByMaterial.set(mr.materialCode, list);
  }

  for (const [code, reqs] of Array.from(reqsByMaterial.entries())) {
    const state = invStateMap.get(code);
    const item = invItemMap.get(code);
    if (!item) continue;

    const totalRequired = reqs.reduce((s, r) => s + r.requiredQty, 0);
    const available = state?.availableQty ?? 0;
    const incoming = state?.incomingQty ?? 0;
    const shortage = totalRequired - available - incoming;

    if (shortage > 0) {
      shortageItems.push({
        materialCode: code,
        inventoryItemId: item.id,
        description: item.description,
        shortageQty: shortage,
        requiredQty: totalRequired,
        availableQty: available,
        incomingQty: incoming,
        projects: reqs.map((r) => ({
          id: r.project.id,
          name: r.project.name,
          jobNumber: r.project.jobNumber,
          requiredQty: r.requiredQty,
        })),
      });
    }
  }

  // Resolve default suppliers for shortage items
  const shortageInvIds = shortageItems.map((s) => s.inventoryItemId);
  const supplierMap = await resolveDefaultSuppliers(shortageInvIds);

  // Group shortages by supplier
  const shortagesBySupplier: Record<
    string,
    {
      supplierId: string;
      supplierName: string;
      supplierEmail: string | null;
      items: typeof shortageItems;
    }
  > = {};

  for (const shortage of shortageItems) {
    const resolved = supplierMap.get(shortage.inventoryItemId);
    const supplierId = resolved?.supplierId ?? "unknown";
    const supplierName = resolved?.supplierName ?? "Unassigned";
    const supplierEmail = resolved?.supplierEmail ?? null;

    if (!shortagesBySupplier[supplierId]) {
      shortagesBySupplier[supplierId] = {
        supplierId,
        supplierName,
        supplierEmail,
        items: [],
      };
    }
    shortagesBySupplier[supplierId].items.push(shortage);
  }

  // --- Orders In-Flight ---
  const now = new Date();
  const ordersInFlight = orders.map((o) => {
    const isLate =
      o.status === "placed" &&
      o.expectedDeliveryDate &&
      new Date(o.expectedDeliveryDate) < now;
    const isBackordered = !!(o.backorderNotes || o.backorderExpectedDate);
    const totalLines = o.lines.length;
    const receivedLines = o.lines.filter((l) => l.receivedQty >= l.quantity).length;

    return {
      id: o.id,
      supplier: o.supplierRef?.name ?? o.supplier,
      status: o.status,
      orderType: (o as Record<string, unknown>).orderType ?? "order",
      expectedDeliveryDate: o.expectedDeliveryDate,
      placedAt: o.placedAt,
      isLate,
      isBackordered,
      backorderNotes: o.backorderNotes,
      backorderExpectedDate: o.backorderExpectedDate,
      project: o.project,
      totalLines,
      receivedLines,
      lines: o.lines.map((l) => ({
        id: l.id,
        materialCode: l.materialCode,
        description: l.inventoryItem?.description ?? l.materialCode,
        quantity: l.quantity,
        receivedQty: l.receivedQty,
        unitCost: l.unitCost,
        hasDeviation: l.receivingDeviations.length > 0,
      })),
    };
  });

  // --- Quick Stats ---
  const totalActive = projectHealth.filter((p) => !p.isDraft).length;
  const totalShortages = shortageItems.length;
  const ordersPending = orders.filter((o) => o.status !== "received").length;
  const onTrack = projectHealth.filter((p) => p.deviationCount === 0 && !p.isDraft).length;
  const onTrackPct = totalActive > 0 ? Math.round((onTrack / totalActive) * 100) : 100;

  return NextResponse.json({
    projectHealth,
    shortagesBySupplier: Object.values(shortagesBySupplier),
    ordersInFlight,
    deviations,
    stats: {
      totalActive,
      totalShortages,
      ordersPending,
      onTrackPct,
    },
  });
}
