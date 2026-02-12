"use client";

import { formatCurrency } from "@/lib/format";

type Snapshot = {
  totalProjects: number;
  activeProjects: number;
  projectsWithDeviations: number;
  avgMargin: number;
  totalCostVariance: number;
  inventoryBelowThreshold: number;
  openOrders: number;
};

export function DashboardSnapshot({ data }: { data: Snapshot }) {
  const cards = [
    { label: "Total projects", value: data.totalProjects, variant: "neutral" },
    { label: "Active projects", value: data.activeProjects, variant: "neutral" },
    {
      label: "With deviations",
      value: data.projectsWithDeviations,
      variant: data.projectsWithDeviations > 0 ? "caution" : "neutral",
    },
    {
      label: "Avg margin %",
      value: `${data.avgMargin.toFixed(1)}%`,
      variant: data.avgMargin < 25 ? "caution" : "neutral",
    },
    {
      label: "Total cost variance",
      value: formatCurrency(data.totalCostVariance),
      variant: data.totalCostVariance > 0 ? "caution" : "neutral",
    },
    {
      label: "Inventory below threshold",
      value: data.inventoryBelowThreshold,
      variant: data.inventoryBelowThreshold > 0 ? "caution" : "neutral",
    },
    {
      label: "Open orders",
      value: data.openOrders,
      variant: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`neumorphic-panel-blue p-4 ${card.variant === "caution" ? "severity-medium" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {typeof card.value === "number" ? card.value : card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
