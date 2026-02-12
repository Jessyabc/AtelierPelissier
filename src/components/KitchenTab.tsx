"use client";

import { useCallback, useEffect, useState } from "react";
import { computeKitchenSelling } from "@/lib/pricing/kitchen";
import { formatCurrency } from "@/lib/format";

const CATEGORIES = [
  "sheet_goods",
  "doors_fronts",
  "hardware",
  "labour_shop",
  "labour_install",
  "delivery",
  "misc",
] as const;

type CostLine = { id: string; kind: string; category: string; amount: number };

type Project = {
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number } | null;
  costLines: CostLine[];
};

export function KitchenTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const settings = project.projectSettings;
  const markup = settings?.markup ?? 2.5;
  const taxEnabled = settings?.taxEnabled ?? false;
  const taxRate = settings?.taxRate ?? 0.14975;

  const [lines, setLines] = useState<CostLine[]>(project.costLines.filter((l) => l.kind === "estimate"));
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLines(project.costLines.filter((l) => l.kind === "estimate"));
  }, [project.costLines]);

  const costSubtotal = lines.reduce((s, l) => s + l.amount, 0);
  const kitchenResult = computeKitchenSelling({
    costSubtotal,
    markup,
    taxEnabled,
    taxRate,
  });
  const { breakdown } = kitchenResult;

  const addLine = useCallback(async () => {
    const cat = (newCategory.trim() || "misc").toLowerCase().replace(/\s+/g, "_");
    const amt = parseFloat(newAmount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "estimate", category: cat, amount: amt }),
      });
      const created = await res.json();
      setLines((prev) => [...prev, created]);
      setNewCategory("");
      setNewAmount("");
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projectId, newCategory, newAmount, onUpdate]);

  const updateLine = useCallback(
    async (lineId: string, updates: { category?: string; amount?: number }) => {
      await fetch(`/api/projects/${projectId}/cost-lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? { ...l, ...updates }
            : l
        )
      );
      onUpdate();
    },
    [projectId, onUpdate]
  );

  const deleteLine = useCallback(
    async (lineId: string) => {
      await fetch(`/api/projects/${projectId}/cost-lines/${lineId}`, { method: "DELETE" });
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      onUpdate();
    },
    [projectId, onUpdate]
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Kitchen pricing: cost-plus. Enter cost lines by category; selling price = cost total × markup.
        Tax is applied from Settings.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Category (e.g. sheet_goods)"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="Amount"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          className="w-28 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={addLine}
          disabled={saving || !newAmount}
          className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Add line
        </button>
      </div>

      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium">Category</th>
            <th className="border border-gray-200 px-3 py-2 text-right text-sm font-medium">Amount</th>
            <th className="border border-gray-200 px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="border border-gray-200 px-3 py-2">
                <input
                  type="text"
                  value={l.category}
                  onChange={(e) => updateLine(l.id, { category: e.target.value })}
                  onBlur={(e) => updateLine(l.id, { category: e.target.value.trim() || "misc" })}
                  className="w-full rounded border-0 bg-transparent"
                />
              </td>
              <td className="border border-gray-200 px-3 py-2 text-right">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={l.amount}
                  onChange={(e) => updateLine(l.id, { amount: parseFloat(e.target.value) || 0 })}
                  className="w-28 rounded border border-gray-200 text-right"
                />
              </td>
              <td className="border border-gray-200 px-3 py-2">
                <button
                  type="button"
                  onClick={() => deleteLine(l.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded bg-gray-50 p-4">
        <h3 className="mb-2 font-medium text-gray-800">Kitchen pricing</h3>
        <p className="text-lg">
          <span className="text-gray-600">Cost subtotal: </span>
          <strong>{formatCurrency(breakdown.costSubtotal)}</strong>
        </p>
        <p className="text-lg">
          <span className="text-gray-600">Markup ×{markup}: </span>
          <strong>{formatCurrency(breakdown.sellingPriceBeforeTax)}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(breakdown.sellingPriceBeforeTax))}
            className="ml-2 rounded px-2 py-0.5 text-sm text-gray-500 hover:bg-gray-200"
          >
            Copy
          </button>
        </p>
        {taxEnabled && (
          <>
            <p className="text-lg">
              <span className="text-gray-600">Tax ({(taxRate * 100).toFixed(2)}%): </span>
              <strong>{formatCurrency(breakdown.taxAmount)}</strong>
            </p>
            <p className="mt-2 text-lg font-medium">
              <span className="text-gray-600">Total with tax: </span>
              {formatCurrency(breakdown.total)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
