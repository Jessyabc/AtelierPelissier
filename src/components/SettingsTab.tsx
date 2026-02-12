"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type SheetFormat = { id: string; label: string; lengthIn: number; widthIn: number; isCustom: boolean };

type Project = {
  projectSettings: {
    markup: number;
    taxEnabled: boolean;
    taxRate: number;
    sheetFormatId: string | null;
    sheetFormat?: { id: string; label: string } | null;
  } | null;
};

export function SettingsTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const settings = project.projectSettings;
  const [markup, setMarkup] = useState(settings?.markup ?? 2.5);
  const [taxEnabled, setTaxEnabled] = useState(settings?.taxEnabled ?? false);
  const [taxRate, setTaxRate] = useState(settings?.taxRate ?? 0.14975);
  const [sheetFormatId, setSheetFormatId] = useState<string | "">(settings?.sheetFormatId ?? "");
  const [formats, setFormats] = useState<SheetFormat[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMarkup(settings?.markup ?? 2.5);
    setTaxEnabled(settings?.taxEnabled ?? false);
    setTaxRate(settings?.taxRate ?? 0.14975);
    setSheetFormatId(settings?.sheetFormatId ?? "");
  }, [settings]);

  useEffect(() => {
    fetch("/api/sheet-formats")
      .then((res) => res.json())
      .then((data) => setFormats(Array.isArray(data) ? data : []))
      .catch(() => setFormats([]));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markup: Number(markup) || 2.5,
          taxEnabled,
          taxRate: Number(taxRate) ?? 0.14975,
          sheetFormatId: sheetFormatId || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdate();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [projectId, markup, taxEnabled, taxRate, sheetFormatId, onUpdate]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Markup (e.g. 2.5 = 2.5×)</label>
          <input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="taxEnabled"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
          />
          <label htmlFor="taxEnabled">Apply tax to totals</label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tax rate (0–1, e.g. 0.14975)</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.00001}
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Sheet format (default)</label>
          <select
            value={sheetFormatId}
            onChange={(e) => setSheetFormatId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
