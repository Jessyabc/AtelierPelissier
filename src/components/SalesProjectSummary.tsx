"use client";

/**
 * Sales-facing project summary.
 *
 * Shown inside the "Estimates & Costs" tab when the viewing user has the
 * `salesperson` role. Intentionally narrow:
 *   - Panel / hinge / drawer-box totals only (no cost lines or cutlists).
 *   - For invoiced / confirmed projects, a copy-pastable order description
 *     that can be pasted directly into the accounting invoice.
 *   - For quote stage, the same totals framed as "builder summary".
 *
 * Planner + admin still see the full product-builder stack.
 */

import {
  OrderDescriptionBlock,
  computeOrderTotals,
  type OrderDescriptionProject,
} from "./OrderDescriptionBlock";

type ProjectLike = OrderDescriptionProject & {
  types: string;
};

export function SalesProjectSummary({ project }: { project: ProjectLike }) {
  const stage = project.stage ?? "quote";
  const showOrderDescription = stage === "invoiced" || stage === "confirmed";
  const totals = computeOrderTotals(project);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {showOrderDescription ? "Order description" : "Builder summary"}
        </h3>
        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
          {showOrderDescription
            ? "Copy-paste this into the accounting invoice. Full material and cost breakdown is managed by the planner."
            : "Totals your client sees. Cost, cutlists, and granular materials are handled downstream by the planner."}
        </p>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="neo-card p-4 text-center">
          <div className="text-[10px] uppercase text-[var(--foreground-muted)]">Panels</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{totals.panelQty}</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-[10px] uppercase text-[var(--foreground-muted)]">Hinges</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{totals.hinges || "—"}</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-[10px] uppercase text-[var(--foreground-muted)]">Drawer boxes</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{totals.drawerBoxes || "—"}</div>
        </div>
      </div>

      {showOrderDescription ? (
        <OrderDescriptionBlock
          project={project}
          title="Copy for invoice"
        />
      ) : (
        <div className="neo-panel-inset p-4 text-xs text-[var(--foreground-muted)]">
          This view hides internal cost breakdowns, cutlists, and material
          sourcing details. Those live with the planner until the project is
          invoiced or confirmed.
        </div>
      )}
    </div>
  );
}
