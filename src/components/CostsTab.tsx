"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format";

type CostLine = { id: string; kind: string; category: string; amount: number };

type Project = {
  costLines: CostLine[];
};

export function CostsTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const [estimateLines, setEstimateLines] = useState<CostLine[]>([]);
  const [actualLines, setActualLines] = useState<CostLine[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newKind, setNewKind] = useState<"estimate" | "actual">("actual");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEstimateLines(project.costLines.filter((l) => l.kind === "estimate"));
    setActualLines(project.costLines.filter((l) => l.kind === "actual"));
  }, [project.costLines]);

  const categories = Array.from(
    new Set([
      ...estimateLines.map((l) => l.category),
      ...actualLines.map((l) => l.category),
    ])
  ).sort();

  const byCategory = (kind: "estimate" | "actual") => {
    const list = kind === "estimate" ? estimateLines : actualLines;
    const map = new Map<string, number>();
    for (const l of list) map.set(l.category, (map.get(l.category) ?? 0) + l.amount);
    return map;
  };
  const estMap = byCategory("estimate");
  const actMap = byCategory("actual");

  const estimateTotal = estimateLines.reduce((s, l) => s + l.amount, 0);
  const actualTotal = actualLines.reduce((s, l) => s + l.amount, 0);
  const varianceTotal = actualTotal - estimateTotal;
  const variancePctTotal = estimateTotal ? (varianceTotal / estimateTotal) * 100 : 0;

  const addLine = useCallback(async () => {
    const cat = (newCategory.trim() || "misc").toLowerCase().replace(/\s+/g, "_");
    const amt = parseFloat(newAmount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: newKind, category: cat, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add");
      setNewCategory("");
      setNewAmount("");
      onUpdate();
      toast.success("Cost line added");
    } catch {
      toast.error("Failed to add cost line");
    } finally {
      setSaving(false);
    }
  }, [projectId, newCategory, newAmount, newKind, onUpdate]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Compare estimated costs vs actual invoice costs by category. Add actual cost lines below.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as "estimate" | "actual")}
          className="rounded border border-gray-300 px-3 py-2"
        >
          <option value="estimate">Estimate</option>
          <option value="actual">Actual</option>
        </select>
        <input
          type="text"
          placeholder="Category"
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
          Add
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium">Category</th>
              <th className="border border-gray-200 px-3 py-2 text-right text-sm font-medium">Estimated</th>
              <th className="border border-gray-200 px-3 py-2 text-right text-sm font-medium">Actual</th>
              <th className="border border-gray-200 px-3 py-2 text-right text-sm font-medium">Variance</th>
              <th className="border border-gray-200 px-3 py-2 text-right text-sm font-medium">Variance %</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const est = estMap.get(cat) ?? 0;
              const act = actMap.get(cat) ?? 0;
              const variance = act - est;
              const variancePct = est ? (variance / est) * 100 : 0;
              return (
                <tr key={cat}>
                  <td className="border border-gray-200 px-3 py-2">{cat}</td>
                  <td className="border border-gray-200 px-3 py-2 text-right">{formatCurrency(est)}</td>
                  <td className="border border-gray-200 px-3 py-2 text-right">{formatCurrency(act)}</td>
                  <td className={`border border-gray-200 px-3 py-2 text-right ${variance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {formatCurrency(variance)}
                  </td>
                  <td className={`border border-gray-200 px-3 py-2 text-right ${variancePct >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {est ? `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-medium">
              <td className="border border-gray-200 px-3 py-2">Total</td>
              <td className="border border-gray-200 px-3 py-2 text-right">{formatCurrency(estimateTotal)}</td>
              <td className="border border-gray-200 px-3 py-2 text-right">{formatCurrency(actualTotal)}</td>
              <td className={`border border-gray-200 px-3 py-2 text-right ${varianceTotal >= 0 ? "text-gray-900" : "text-red-600"}`}>
                {formatCurrency(varianceTotal)}
              </td>
              <td className={`border border-gray-200 px-3 py-2 text-right ${variancePctTotal >= 0 ? "text-gray-900" : "text-red-600"}`}>
                {estimateTotal ? `${variancePctTotal >= 0 ? "+" : ""}${variancePctTotal.toFixed(1)}%` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
