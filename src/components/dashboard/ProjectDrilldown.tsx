"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type Project = {
  id: string;
  name: string;
  type: string;
  types: string;
  costLines: Array<{ kind: string; amount: number }>;
  projectSettings?: { markup: number } | null;
  materialRequirements: Array<{ materialCode: string; requiredQty: number; allocatedQty: number }>;
  orders: Array<{ id: string; supplier: string; status: string }>;
  deviations: Array<{ type: string; severity: string; message: string }>;
};

export function ProjectDrilldown({ project }: { project: Project }) {
  const estLines = project.costLines.filter((l) => l.kind === "estimate");
  const actLines = project.costLines.filter((l) => l.kind === "actual");
  const expectedCost = estLines.reduce((s, l) => s + l.amount, 0);
  const realCost = actLines.reduce((s, l) => s + l.amount, 0);
  const variance = realCost - expectedCost;
  const markup = project.projectSettings?.markup ?? 2.5;
  const recommendedSalesPrice = expectedCost * markup;
  const realMargin =
    recommendedSalesPrice > 0 ? ((recommendedSalesPrice - realCost) / recommendedSalesPrice) * 100 : 0;

  return (
    <div className="neumorphic-panel-blue space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${project.id}`}
          className="font-semibold text-brand-blue hover:underline"
        >
          {project.name}
        </Link>
        <span className="text-xs text-gray-500">{project.types || project.type}</span>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-gray-500">Expected cost</span>
          <p className="font-medium">{formatCurrency(expectedCost)}</p>
        </div>
        <div>
          <span className="text-gray-500">Real cost</span>
          <p className="font-medium">{formatCurrency(realCost)}</p>
        </div>
        <div>
          <span className="text-gray-500">Variance</span>
          <p className={`font-medium ${variance > 0 ? "text-amber-600" : ""}`}>
            {formatCurrency(variance)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Recommended sales price</span>
          <p className="font-medium">{formatCurrency(recommendedSalesPrice)}</p>
        </div>
        <div>
          <span className="text-gray-500">Real margin %</span>
          <p className={`font-medium ${realMargin < 25 ? "text-amber-600" : ""}`}>
            {realMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {project.materialRequirements.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase text-gray-500">Material requirements</h3>
          <ul className="mt-1 space-y-1">
            {project.materialRequirements.map((mr) => (
              <li key={mr.materialCode} className="text-sm">
                {mr.materialCode}: required {mr.requiredQty.toFixed(1)}, allocated{" "}
                {mr.allocatedQty.toFixed(1)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.orders.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase text-gray-500">Linked orders</h3>
          <ul className="mt-1 space-y-1">
            {project.orders.map((o) => (
              <li key={o.id} className="text-sm">
                {o.supplier} — {o.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.deviations.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase text-gray-500">Deviations</h3>
          <ul className="mt-1 space-y-1">
            {project.deviations.map((d, i) => (
              <li key={i} className="text-sm text-amber-700">
                {d.type}: {d.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
