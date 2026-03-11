"use client";

import { useState, useEffect, useCallback } from "react";

type OrderDetail = {
  id: string;
  supplier: string;
  status: string;
  lines: {
    id: string;
    materialCode: string;
    quantity: number;
    receivedQty: number;
    inventoryItem?: { description: string } | null;
  }[];
};

type ImpactData = {
  materialCode: string;
  shortfall: number;
  affectedProjects: { id: string; name: string; jobNumber: string | null; gap: number }[];
  borrowOptions: { projectId: string; projectName: string; jobNumber: string | null; allocatedQty: number; hasTimeSlack: boolean }[];
  recommendation: "borrow" | "reorder" | "none";
};

type LineInput = {
  orderLineId: string;
  receivedQty: number;
  reason: string;
};

export function ReceiveOrderModal({
  orderId,
  onClose,
  onComplete,
}: {
  orderId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineInputs, setLineInputs] = useState<Map<string, LineInput>>(new Map());
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<null | {
    results: { orderLineId: string; isDeviation: boolean; receivingDeviation?: { impact: string } }[];
  }>(null);
  const [impactData, setImpactData] = useState<Map<string, ImpactData>>(new Map());

  const loadOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data);
      const inputs = new Map<string, LineInput>();
      for (const line of data.lines) {
        const remaining = line.quantity - line.receivedQty;
        inputs.set(line.id, {
          orderLineId: line.id,
          receivedQty: remaining,
          reason: "",
        });
      }
      setLineInputs(inputs);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  function updateLine(lineId: string, field: keyof LineInput, value: string | number) {
    setLineInputs((prev) => {
      const next = new Map(prev);
      const current = next.get(lineId);
      if (current) {
        next.set(lineId, { ...current, [field]: value });
      }
      return next;
    });
  }

  async function checkImpact(materialCode: string, shortfall: number) {
    if (shortfall <= 0) return;
    const res = await fetch(`/api/ops/impact-analysis?materialCode=${encodeURIComponent(materialCode)}&shortfall=${shortfall}`);
    if (res.ok) {
      const data = await res.json();
      setImpactData((prev) => {
        const next = new Map(prev);
        next.set(materialCode, data);
        return next;
      });
    }
  }

  function handleQtyBlur(line: OrderDetail["lines"][0], input: LineInput) {
    const expected = line.quantity - line.receivedQty;
    if (input.receivedQty < expected) {
      checkImpact(line.materialCode, expected - input.receivedQty);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const linesToSubmit = Array.from(lineInputs.values()).filter(
        (l) => l.receivedQty > 0 || l.reason
      );

      const res = await fetch("/api/ops/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lines: linesToSubmit }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        alert("Failed to process receiving");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReceiveAll() {
    if (!order) return;
    const inputs = new Map<string, LineInput>();
    for (const line of order.lines) {
      const remaining = line.quantity - line.receivedQty;
      inputs.set(line.id, {
        orderLineId: line.id,
        receivedQty: remaining,
        reason: "",
      });
    }
    setLineInputs(inputs);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="neo-card p-8 text-center text-[var(--foreground-muted)]">Loading order...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="neo-card p-8 text-center">
          <p className="text-red-500">Order not found</p>
          <button onClick={onClose} className="neo-btn px-4 py-2 text-sm mt-3">Close</button>
        </div>
      </div>
    );
  }

  const pendingLines = order.lines.filter((l) => l.receivedQty < l.quantity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="neo-card p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {results ? "Receiving Complete" : `Receive Order — ${order.supplier}`}
          </h2>
          <button onClick={onClose} className="neo-icon-btn w-8 h-8 text-sm">x</button>
        </div>

        {results ? (
          <div className="space-y-4">
            {results.results.map((r) => {
              const line = order.lines.find((l) => l.id === r.orderLineId);
              return (
                <div
                  key={r.orderLineId}
                  className={`neo-card p-3 ${r.isDeviation ? "severity-medium" : ""}`}
                >
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {line?.inventoryItem?.description ?? line?.materialCode}
                  </div>
                  {r.isDeviation && r.receivingDeviation?.impact && (
                    <div className="text-xs text-yellow-700 mt-1">
                      {r.receivingDeviation.impact}
                    </div>
                  )}
                  {!r.isDeviation && (
                    <div className="text-xs text-emerald-600 mt-1">Received as expected</div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end">
              <button onClick={onComplete} className="neo-btn-primary px-5 py-2.5 text-sm font-medium">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingLines.length === 0 ? (
              <p className="text-[var(--foreground-muted)] text-center py-4">
                All lines already received.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button onClick={handleReceiveAll} className="neo-btn px-3 py-1.5 text-xs">
                    Check All — Received
                  </button>
                </div>

                <div className="space-y-3">
                  {pendingLines.map((line) => {
                    const input = lineInputs.get(line.id);
                    const expected = line.quantity - line.receivedQty;
                    const isShort = (input?.receivedQty ?? 0) < expected;
                    const impact = impactData.get(line.materialCode);

                    return (
                      <div key={line.id} className={`neo-card p-4 ${isShort ? "severity-medium" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-[var(--foreground)]">
                              {line.inventoryItem?.description ?? line.materialCode}
                            </div>
                            <div className="text-xs text-[var(--foreground-muted)]">
                              Code: {line.materialCode} — Expected: {expected}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-[var(--foreground-muted)]">Received:</label>
                            <input
                              type="number"
                              min={0}
                              max={expected}
                              value={input?.receivedQty ?? expected}
                              onChange={(e) => updateLine(line.id, "receivedQty", parseInt(e.target.value) || 0)}
                              onBlur={() => input && handleQtyBlur(line, input)}
                              className="neo-input w-20 px-2 py-1.5 text-sm text-center"
                            />
                          </div>
                        </div>

                        {isShort && (
                          <div className="mt-3 space-y-2">
                            <input
                              type="text"
                              value={input?.reason ?? ""}
                              onChange={(e) => updateLine(line.id, "reason", e.target.value)}
                              placeholder="Reason for deviation (required)"
                              className="neo-input w-full px-3 py-2 text-sm"
                            />

                            {impact && (
                              <div className="neo-panel-inset p-3 text-xs space-y-1">
                                <div className="font-medium text-[var(--foreground)]">Impact Analysis</div>
                                {impact.affectedProjects.map((p) => (
                                  <div key={p.id} className="text-[var(--foreground-muted)]">
                                    {p.jobNumber ?? p.name}: needs {p.gap} more
                                  </div>
                                ))}
                                {impact.borrowOptions.length > 0 && (
                                  <div className="text-blue-600 mt-1">
                                    Borrow option: {impact.borrowOptions[0].jobNumber ?? impact.borrowOptions[0].projectName} has {impact.borrowOptions[0].allocatedQty} allocated with time slack
                                  </div>
                                )}
                                <div className="font-medium mt-1 text-[var(--foreground)]">
                                  Recommendation: {impact.recommendation === "borrow" ? "Borrow from another project" : "Reorder"}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={onClose} className="neo-btn px-4 py-2 text-sm">Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? "Processing..." : "Confirm Receiving"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
