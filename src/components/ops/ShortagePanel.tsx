"use client";

import Link from "next/link";
import type { SupplierShortageGroup } from "@/app/home/page";

export function ShortagePanel({
  groups,
  onOrder,
}: {
  groups: SupplierShortageGroup[];
  onOrder: (group: SupplierShortageGroup) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">
        Action Required: Shortages
      </h2>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.supplierId} className="neo-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold text-[var(--foreground)]">
                  {group.supplierName}
                </span>
                <span className="ml-2 text-xs text-[var(--foreground-muted)]">
                  {group.items.length} material{group.items.length !== 1 ? "s" : ""} short
                </span>
              </div>
              <button
                onClick={() => onOrder(group)}
                className="neo-btn-primary px-4 py-2 text-sm font-medium"
              >
                Order from {group.supplierName}
              </button>
            </div>

            <div className="neo-panel-inset p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--foreground-muted)]">
                    <th className="pb-2 pr-4">Material</th>
                    <th className="pb-2 pr-4 text-right">Need</th>
                    <th className="pb-2 pr-4 text-right">Available</th>
                    <th className="pb-2 pr-4 text-right">Incoming</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Short</th>
                    <th className="pb-2">Projects</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.materialCode} className="border-t border-[var(--shadow-dark)]/20">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-[var(--foreground)]">{item.materialCode}</div>
                        <div className="text-xs text-[var(--foreground-muted)]">{item.description}</div>
                      </td>
                      <td className="py-2 pr-4 text-right">{item.requiredQty}</td>
                      <td className="py-2 pr-4 text-right">{item.availableQty}</td>
                      <td className="py-2 pr-4 text-right">{item.incomingQty}</td>
                      <td className="py-2 pr-4 text-right font-bold text-red-500">{item.shortageQty}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {item.projects.map((proj) => (
                            <Link
                              key={proj.id}
                              href={`/projects/${proj.id}`}
                              className="text-xs bg-[var(--bg-light)] px-2 py-0.5 rounded-full hover:bg-[var(--accent-soft)] transition-colors"
                            >
                              {proj.jobNumber ?? proj.name}
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
