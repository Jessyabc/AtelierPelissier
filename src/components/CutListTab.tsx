"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type PanelPart = {
  id?: string;
  label: string;
  lengthIn: number;
  widthIn: number;
  qty: number;
  materialCode?: string | null;
  thicknessIn?: number | null;
  cutlistId?: string | null;
};

type MaterialReq = {
  materialCode: string;
  requiredQty: number;
  allocatedQty: number;
};

type SheetFmt = { lengthIn?: number; widthIn?: number; [key: string]: unknown };

type Project = {
  panelParts: PanelPart[];
  materialRequirements?: MaterialReq[];
  projectSettings?: { sheetFormat?: SheetFmt | null } | null;
};

const STANDARD_SHEET = { lengthIn: 96, widthIn: 48 };
const DEFAULT_WASTE = 1.1;

/** Optional cutlistId: null = project-level only (save/delete scoped); string = that cutlist's parts */
export function CutListTab({
  projectId,
  project,
  onUpdate,
  cutlistId,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
  cutlistId?: string | null;
}) {
  const [parts, setParts] = useState<PanelPart[]>(project.panelParts);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addRow, setAddRow] = useState<PanelPart>({ label: "", lengthIn: 0, widthIn: 0, qty: 1, materialCode: "", thicknessIn: null });

  useEffect(() => {
    const list = cutlistId !== undefined
      ? project.panelParts.filter((p) => (p as PanelPart).cutlistId === cutlistId)
      : project.panelParts;
    setParts(list);
  }, [project.panelParts, cutlistId]);

  const fmt = project.projectSettings?.sheetFormat;
  const sheet: { lengthIn: number; widthIn: number } =
    (fmt && typeof fmt.lengthIn === "number" && typeof fmt.widthIn === "number")
      ? { lengthIn: fmt.lengthIn, widthIn: fmt.widthIn }
      : STANDARD_SHEET;

  // Live sheet-requirement computation
  const sheetRequirements = useMemo(() => {
    const result: Record<string, { totalArea: number; sheets: number; parts: number }> = {};
    const sheetArea = sheet.lengthIn * sheet.widthIn;
    for (const p of parts) {
      const code = (p.materialCode ?? "").trim();
      if (!code) continue;
      const area = p.lengthIn * p.widthIn * p.qty;
      if (area <= 0) continue;
      if (!result[code]) result[code] = { totalArea: 0, sheets: 0, parts: 0 };
      result[code].totalArea += area;
      result[code].parts += p.qty;
    }
    for (const code of Object.keys(result)) {
      result[code].sheets = sheetArea > 0
        ? Math.ceil((result[code].totalArea / sheetArea) * DEFAULT_WASTE)
        : Math.ceil(result[code].totalArea);
    }
    return result;
  }, [parts, sheet]);

  const parsePdf = useCallback(async () => {
    setParseError("");
    setParsing(true);
    try {
      let res: Response;
      if (file && file.size > 0) {
        const formData = new FormData();
        formData.set("file", file);
        res = await fetch("/api/parse-cutlist", { method: "POST", body: formData });
      } else if (pasteText.trim()) {
        res = await fetch("/api/parse-cutlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasteText }),
        });
      } else {
        setParseError("Upload a PDF or paste text.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || "Could not read text from PDF");
        if (data.details) setParseError((e) => `${e}. Paste text below as fallback.`);
        return;
      }
      setParts(data.parts || []);
      setFile(null);
    } finally {
      setParsing(false);
    }
  }, [file, pasteText]);

  const parsePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    setParseError("");
    setParsing(true);
    fetch("/api/parse-cutlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.parts?.length) setParts(data.parts);
        else setParseError("No parts found in pasted text.");
      })
      .catch(() => setParseError("Parse failed."))
      .finally(() => setParsing(false));
  }, [pasteText]);

  const updatePart = useCallback((index: number, updates: Partial<PanelPart>) => {
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  }, []);

  const removePart = useCallback((index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  function addNewPart() {
    if (!addRow.label.trim() || addRow.lengthIn <= 0 || addRow.widthIn <= 0) {
      toast.error("Label, length, and width required");
      return;
    }
    setParts((prev) => [...prev, { ...addRow, id: undefined }]);
    setAddRow({ label: "", lengthIn: 0, widthIn: 0, qty: 1, materialCode: "", thicknessIn: null });
  }

  const saveToProject = useCallback(async () => {
    setSaving(true);
    try {
      const deleteUrl =
        cutlistId === undefined
          ? `/api/projects/${projectId}/parts`
          : `/api/projects/${projectId}/parts?cutlistId=${cutlistId === null ? "null" : cutlistId}`;
      await fetch(deleteUrl, { method: "DELETE" });

      for (const p of parts) {
        await fetch(`/api/projects/${projectId}/parts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: p.label,
            lengthIn: p.lengthIn,
            widthIn: p.widthIn,
            qty: p.qty,
            materialCode: p.materialCode ?? undefined,
            thicknessIn: p.thicknessIn ?? undefined,
            ...(cutlistId !== undefined && cutlistId !== null && { cutlistId }),
          }),
        });
      }

      await fetch(`/api/projects/${projectId}/recalculate`, { method: "POST" });
      onUpdate();
      toast.success("Parts saved and material requirements updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [projectId, parts, onUpdate, cutlistId]);

  const existingReqs = project.materialRequirements ?? [];

  return (
    <div className="space-y-6">
      {/* Import section */}
      <div className="neo-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Import Cut List</h3>
        <p className="text-xs text-[var(--foreground-muted)]">
          Upload a cut list PDF from your optimizer, paste text output, or add parts manually below.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">PDF file</label>
            <input
              type="file"
              accept=".pdf,.csv,.txt"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setParseError(""); }}
              className="block text-sm text-[var(--foreground-muted)]"
            />
          </div>
          <button
            type="button"
            onClick={parsePdf}
            disabled={parsing || (!file?.size && !pasteText.trim())}
            className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {parsing ? "Parsing..." : "Parse"}
          </button>
        </div>
        {parseError && (
          <div className="p-2 text-xs text-amber-700 bg-amber-50 rounded">{parseError}</div>
        )}
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Or paste text</label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste optimizer output..."
            rows={3}
            className="neo-input w-full px-3 py-2 font-mono text-sm"
          />
          <button type="button" onClick={parsePaste} disabled={parsing || !pasteText.trim()} className="neo-btn px-3 py-1 text-xs mt-1 disabled:opacity-50">
            Parse pasted text
          </button>
        </div>
      </div>

      {/* Parts table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Parts ({parts.length})
          </h3>
          <span className="text-xs text-[var(--foreground-muted)]">
            Sheet: {sheet.lengthIn}&quot; x {sheet.widthIn}&quot; ({DEFAULT_WASTE * 100 - 100}% waste factor)
          </span>
        </div>

        <div className="neo-panel-inset p-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--foreground-muted)]">
                <th className="pb-2 pr-2">Label</th>
                <th className="pb-2 pr-2 text-right">L (in)</th>
                <th className="pb-2 pr-2 text-right">W (in)</th>
                <th className="pb-2 pr-2 text-right">Qty</th>
                <th className="pb-2 pr-2">Material</th>
                <th className="pb-2 pr-2 text-right">Thick</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={p.id ?? i} className="border-t border-[var(--shadow-dark)]/20">
                  <td className="py-1 pr-2">
                    <input type="text" value={p.label} onChange={(e) => updatePart(i, { label: e.target.value })} className="neo-input w-full px-2 py-1 text-sm" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} value={p.lengthIn} onChange={(e) => updatePart(i, { lengthIn: parseFloat(e.target.value) || 0 })} className="neo-input w-16 px-2 py-1 text-sm text-right" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} value={p.widthIn} onChange={(e) => updatePart(i, { widthIn: parseFloat(e.target.value) || 0 })} className="neo-input w-16 px-2 py-1 text-sm text-right" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} value={p.qty} onChange={(e) => updatePart(i, { qty: parseInt(e.target.value) || 0 })} className="neo-input w-14 px-2 py-1 text-sm text-right" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="text" value={p.materialCode ?? ""} onChange={(e) => updatePart(i, { materialCode: e.target.value || null })} className="neo-input w-full px-2 py-1 text-sm" placeholder="MLW" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} step={0.125} value={p.thicknessIn ?? ""} onChange={(e) => updatePart(i, { thicknessIn: e.target.value === "" ? null : parseFloat(e.target.value) })} className="neo-input w-16 px-2 py-1 text-sm text-right" placeholder="—" />
                  </td>
                  <td className="py-1">
                    <button onClick={() => removePart(i)} className="text-xs text-red-500 hover:underline">x</button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr className="border-t-2 border-[var(--accent)]/30">
                <td className="py-1 pr-2">
                  <input type="text" value={addRow.label} onChange={(e) => setAddRow((r) => ({ ...r, label: e.target.value }))} className="neo-input w-full px-2 py-1 text-sm" placeholder="New part..." />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min={0} value={addRow.lengthIn || ""} onChange={(e) => setAddRow((r) => ({ ...r, lengthIn: parseFloat(e.target.value) || 0 }))} className="neo-input w-16 px-2 py-1 text-sm text-right" placeholder="L" />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min={0} value={addRow.widthIn || ""} onChange={(e) => setAddRow((r) => ({ ...r, widthIn: parseFloat(e.target.value) || 0 }))} className="neo-input w-16 px-2 py-1 text-sm text-right" placeholder="W" />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min={0} value={addRow.qty || ""} onChange={(e) => setAddRow((r) => ({ ...r, qty: parseInt(e.target.value) || 0 }))} className="neo-input w-14 px-2 py-1 text-sm text-right" placeholder="Q" />
                </td>
                <td className="py-1 pr-2">
                  <input type="text" value={addRow.materialCode ?? ""} onChange={(e) => setAddRow((r) => ({ ...r, materialCode: e.target.value }))} className="neo-input w-full px-2 py-1 text-sm" placeholder="Code" />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min={0} step={0.125} value={addRow.thicknessIn ?? ""} onChange={(e) => setAddRow((r) => ({ ...r, thicknessIn: e.target.value === "" ? null : parseFloat(e.target.value) }))} className="neo-input w-16 px-2 py-1 text-sm text-right" />
                </td>
                <td className="py-1">
                  <button onClick={addNewPart} className="neo-btn-primary px-2 py-0.5 text-xs">+</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={saveToProject}
          disabled={saving || parts.length === 0}
          className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Parts & Calculate Requirements"}
        </button>
      </div>

      {/* Live sheet requirement summary */}
      {Object.keys(sheetRequirements).length > 0 && (
        <div className="neo-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Sheet Requirements (live preview)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(sheetRequirements).map(([code, data]) => {
              const req = existingReqs.find((r) => r.materialCode === code);
              return (
                <div key={code} className="neo-panel-inset p-3 rounded-lg">
                  <div className="font-semibold text-sm text-[var(--foreground)]">{code}</div>
                  <div className="text-lg font-bold text-[var(--accent)]">{data.sheets} sheets</div>
                  <div className="text-xs text-[var(--foreground-muted)]">{data.parts} parts, {(data.totalArea).toFixed(0)} sq in</div>
                  {req && (
                    <div className="text-xs mt-1">
                      <span className={req.allocatedQty >= req.requiredQty ? "text-emerald-600" : "text-amber-600"}>
                        {req.allocatedQty}/{req.requiredQty} allocated
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved material requirements */}
      {existingReqs.length > 0 && (
        <div className="border-t border-[var(--shadow-dark)]/20 pt-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
            Material Requirements (saved)
          </h3>
          <div className="space-y-1">
            {existingReqs.map((r) => (
              <div key={r.materialCode} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-[var(--foreground)]">{r.materialCode}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--foreground-muted)]">Need: {r.requiredQty}</span>
                  <span className={r.allocatedQty >= r.requiredQty ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                    Allocated: {r.allocatedQty}
                  </span>
                  {r.allocatedQty < r.requiredQty && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      Short {r.requiredQty - r.allocatedQty}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
