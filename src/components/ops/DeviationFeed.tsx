"use client";

import Link from "next/link";
import type { Deviation } from "@/app/home/page";

const severityLabel: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const severityBadge: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

const typeLabel: Record<string, string> = {
  margin_risk: "Margin Risk",
  cost_overrun: "Cost Overrun",
  inventory_shortage: "Inventory Shortage",
  order_delay: "Order Delay",
  timeline_risk: "Timeline Risk",
};

export function DeviationFeed({ deviations }: { deviations: Deviation[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">
        Active Deviations
      </h2>
      <div className="neo-panel-inset p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {deviations.map((d) => (
          <div
            key={d.id}
            className={`neo-card p-3 flex items-start gap-3`}
          >
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${severityBadge[d.severity] ?? "bg-gray-100"}`}
            >
              {severityLabel[d.severity] ?? d.severity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--foreground)]">{d.message}</div>
              <div className="flex gap-3 mt-1 text-xs text-[var(--foreground-muted)]">
                <span>{typeLabel[d.type] ?? d.type}</span>
                {d.impactValue != null && <span>Impact: ${d.impactValue.toFixed(2)}</span>}
                <span>{new Date(d.createdAt).toLocaleDateString("en-CA")}</span>
              </div>
            </div>
            {d.projectId && (
              <Link
                href={`/projects/${d.projectId}`}
                className="text-xs neo-btn px-2 py-1 flex-shrink-0"
              >
                View
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
