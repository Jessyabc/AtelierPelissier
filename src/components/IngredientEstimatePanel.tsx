"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  IngredientEstimate,
  ConfigWarning,
} from "@/lib/ingredients/types";

type SnapshotInfo = {
  id: string;
  isStale: boolean;
  isActive: boolean;
  savedAt: string;
  panelCount: number;
  hardwareCount: number;
  sheetCount: number;
  configHash: string;
} | null;

type Props = {
  /** Live computed estimate (not saved yet) */
  estimate: IngredientEstimate;
  /** Configuration warnings (non-blocking advisories) */
  warnings: ConfigWarning[];
  projectId: string;
  sourceType: "vanity" | "side_unit";
  /** Called after save to refresh parent data */
  onSaved?: () => void;
};

/**
 * Shared ingredient estimate display panel.
 *
 * Shows: live estimate summary, panels table, hardware grid, sheet estimates,
 * config warnings, snapshot status, and "Save to Project" button.
 *
 * The live estimate answers "what is needed" (ephemeral).
 * The saved snapshot answers "what this project is saved with" (persistent).
 * Stale snapshot = config changed since save → must regenerate.
 */
export function IngredientEstimatePanel({
  estimate,
  warnings,
  projectId,
  sourceType,
  onSaved,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotInfo>(null);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);

  // Load active snapshot status
  useEffect(() => {
    fetch(`/api/projects/${projectId}/material-snapshot?sourceType=${sourceType}`)
      .then((r) => r.json())
      .then((data) => {
        setSnapshot(data.snapshot ?? null);
        setSnapshotLoaded(true);
      })
      .catch(() => setSnapshotLoaded(true));
  }, [projectId, sourceType]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/material-snapshot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        // Refresh snapshot state
        setSnapshot({
          id: data.snapshotId,
          isStale: false,
          isActive: true,
          savedAt: new Date().toISOString(),
          panelCount: estimate.totalPanelCount,
          hardwareCount: estimate.totalHardwareItems,
          sheetCount: estimate.sheetEstimates.reduce(
            (sum, s) => sum + s.sheetsNeeded,
            0
          ),
          configHash: "",
        });
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  }, [projectId, sourceType, estimate, onSaved]);

  const totalSheets = estimate.sheetEstimates.reduce(
    (s, e) => s + e.sheetsNeeded,
    0
  );

  return (
    <div className="space-y-3">
      {/* Stale snapshot warning */}
      {snapshotLoaded && snapshot?.isStale && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Saved material estimate is out of date.</strong> Regenerate
          and save before using this project for production.
        </div>
      )}

      {/* Configuration warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w) => (
            <div
              key={w.code + (w.sectionId ?? "")}
              className={`rounded px-3 py-2 text-xs ${
                w.severity === "warning"
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Summary bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800">
          Estimated Materials
        </span>
        <span className="text-sm text-gray-500">
          {estimate.totalPanelCount} panels, {estimate.totalHardwareItems} hardware, ~{totalSheets} sheets
          <span className="ml-2">{expanded ? "\u25B2" : "\u25BC"}</span>
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          {/* Panels table */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">Panels</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-1 pr-3">Part</th>
                    <th className="pb-1 pr-3">L &times; W</th>
                    <th className="pb-1 pr-3">Qty</th>
                    <th className="pb-1 pr-3">Material</th>
                    <th className="pb-1">Thick</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.panels.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">{p.label}</td>
                      <td className="py-1 pr-3 text-gray-600">
                        {p.lengthIn.toFixed(2)}&quot; &times;{" "}
                        {p.widthIn.toFixed(2)}&quot;
                      </td>
                      <td className="py-1 pr-3 text-gray-600">{p.qty}</td>
                      <td className="py-1 pr-3 text-gray-500 font-mono">
                        {p.materialCode}
                      </td>
                      <td className="py-1 text-gray-500">
                        {p.thicknessIn}&quot;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hardware grid */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">
              Hardware
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {estimate.hardware.map((h, i) => (
                <div
                  key={i}
                  className="rounded bg-gray-50 px-3 py-2 text-center"
                >
                  <div className="text-lg font-semibold text-gray-800">
                    {h.quantity}
                  </div>
                  <div className="text-xs text-gray-500">{h.label}</div>
                </div>
              ))}
              <div className="rounded bg-gray-50 px-3 py-2 text-center">
                <div className="text-lg font-semibold text-gray-800">
                  {estimate.edgeBandingTotalIn}&quot;
                </div>
                <div className="text-xs text-gray-500">Edge banding</div>
              </div>
            </div>
          </div>

          {/* Sheet estimates */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700">
              Sheet Estimates
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {estimate.sheetEstimates.map((s, i) => (
                <div
                  key={i}
                  className="rounded border border-gray-200 px-3 py-2"
                >
                  <div className="font-mono text-xs text-gray-500">
                    {s.materialCode}
                  </div>
                  <div className="text-sm">
                    <strong>{s.sheetsNeeded}</strong> sheets ({s.panelCount}{" "}
                    panels, {s.rawSheets} raw)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t pt-3">
            <span>Fronts: {estimate.metrics.frontCount}</span>
            <span>Drawers: {estimate.metrics.drawerCount}</span>
            <span>Hinges: {estimate.metrics.hingeCount}</span>
            <span>Dividers: {estimate.metrics.dividerCount}</span>
            <span>Complexity: {estimate.metrics.complexityScore.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Snapshot status + Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving materials..." : "Save materials to project"}
        </button>
        {snapshotLoaded && snapshot && !snapshot.isStale && (
          <span className="text-xs text-green-600">
            Saved {new Date(snapshot.savedAt).toLocaleDateString()}
          </span>
        )}
        {snapshotLoaded && !snapshot && (
          <span className="text-xs text-gray-400">Not yet saved</span>
        )}
      </div>
    </div>
  );
}
