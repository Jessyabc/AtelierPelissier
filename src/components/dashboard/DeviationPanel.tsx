"use client";

import { useState } from "react";

type Deviation = {
  id: string;
  type: string;
  severity: string;
  groupKey: string | null;
  message: string;
  impactValue: number | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
};

function severityClass(s: string): string {
  const m: Record<string, string> = {
    critical: "severity-critical",
    high: "severity-high",
    medium: "severity-medium",
    low: "severity-low",
  };
  return m[s] ?? "";
}

function groupDeviations(deviations: Deviation[]): Map<string, Map<string, Deviation[]>> {
  const byType = new Map<string, Map<string, Deviation[]>>();
  for (const d of deviations) {
    const type = d.type;
    const groupKey = d.groupKey ?? "other";
    if (!byType.has(type)) byType.set(type, new Map());
    const byGroup = byType.get(type)!;
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
    byGroup.get(groupKey)!.push(d);
  }
  return byType;
}

export function DeviationPanel({ deviations }: { deviations: Deviation[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = groupDeviations(deviations);

  const typeOrder = ["timeline_risk", "margin_risk", "cost_overrun", "inventory_shortage", "order_delay"];
  const sortedTypes = Array.from(groups.keys()).sort(
    (a, b) => (typeOrder.indexOf(a) >= 0 ? typeOrder.indexOf(a) : 99) - (typeOrder.indexOf(b) >= 0 ? typeOrder.indexOf(b) : 99)
  );

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (deviations.length === 0) {
    return (
      <div className="neumorphic-panel p-6">
        <h2 className="text-lg font-semibold text-gray-800">Deviations</h2>
        <p className="mt-2 text-sm text-gray-500">No unresolved deviations.</p>
      </div>
    );
  }

  return (
    <div className="neumorphic-panel p-6">
      <h2 className="text-lg font-semibold text-gray-800">Grouped deviations</h2>
      <div className="mt-4 space-y-2">
        {sortedTypes.map((type) => {
          const byGroup = groups.get(type)!;
          return (
            <div key={type} className="space-y-1">
              {Array.from(byGroup.entries()).map(([groupKey, list]: [string, Deviation[]]) => {
                const key = `${type}:${groupKey}`;
                const isExpanded = expanded.has(key);
                const worst = list.reduce(
                  (a: Deviation, b: Deviation) => (severityOrder(b.severity) < severityOrder(a.severity) ? b : a),
                  list[0]
                );
                return (
                  <div
                    key={key}
                    className={`rounded-lg border border-gray-200 ${severityClass(worst.severity)}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/50"
                    >
                      <span className="font-medium capitalize">
                        {type.replace(/_/g, " ")} — {groupKey}
                      </span>
                      <span className="text-gray-500">
                        {list.length} item{list.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-3 py-2">
                        {list.map((d: Deviation) => (
                          <div key={d.id} className="py-1.5 text-sm text-gray-700">
                            <span className="font-medium">{d.severity}</span> — {d.message}
                            {d.project?.name && (
                              <span className="ml-2 text-gray-500">({d.project.name})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function severityOrder(s: string): number {
  const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return o[s] ?? 4;
}
