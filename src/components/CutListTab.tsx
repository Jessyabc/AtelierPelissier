"use client";

import { useCallback, useEffect, useState } from "react";

type PanelPart = {
  id?: string;
  label: string;
  lengthIn: number;
  widthIn: number;
  qty: number;
  materialCode?: string | null;
  thicknessIn?: number | null;
};

type Project = {
  panelParts: PanelPart[];
};

export function CutListTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const [parts, setParts] = useState<PanelPart[]>(project.panelParts);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setParts(project.panelParts);
  }, [project.panelParts]);

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
        if (data.parts && data.parts.length) setParts(data.parts);
        else setParseError("No parts found in pasted text.");
      })
      .catch(() => setParseError("Parse failed."))
      .finally(() => setParsing(false));
  }, [pasteText]);

  const updatePart = useCallback((index: number, updates: Partial<PanelPart>) => {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p))
    );
  }, []);

  const saveToProject = useCallback(async () => {
    setSaving(true);
    try {
      for (const p of parts) {
        if (p.id) continue;
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
          }),
        });
      }
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projectId, parts, onUpdate]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Upload a CutList PDF or paste text to extract the Panneau / Qté table. Edit parts then save to project.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">PDF file</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setParseError("");
            }}
            className="block text-sm text-gray-600"
          />
        </div>
        <button
          type="button"
          onClick={parsePdf}
          disabled={parsing || (!file?.size && !pasteText.trim())}
          className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {parsing ? "Parsing…" : "Parse PDF / text"}
        </button>
      </div>

      {parseError && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {parseError}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Or paste extracted text (fallback)</label>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste table text if PDF extraction fails..."
          rows={4}
          className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          onClick={parsePaste}
          disabled={parsing || !pasteText.trim()}
          className="mt-2 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Parse pasted text
        </button>
      </div>

      {parts.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Label</th>
                  <th className="border border-gray-200 px-2 py-1 text-right text-sm font-medium">Length (in)</th>
                  <th className="border border-gray-200 px-2 py-1 text-right text-sm font-medium">Width (in)</th>
                  <th className="border border-gray-200 px-2 py-1 text-right text-sm font-medium">Qty</th>
                  <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Material</th>
                  <th className="border border-gray-200 px-2 py-1 text-right text-sm font-medium">Thickness (in)</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        type="text"
                        value={p.label}
                        onChange={(e) => updatePart(i, { label: e.target.value })}
                        className="w-full rounded border-0 bg-transparent text-sm"
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-right text-sm">{p.lengthIn}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right text-sm">{p.widthIn}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right text-sm">{p.qty}</td>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        type="text"
                        value={p.materialCode ?? ""}
                        onChange={(e) => updatePart(i, { materialCode: e.target.value || null })}
                        className="w-full rounded border-0 bg-transparent text-sm"
                        placeholder="—"
                      />
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.25}
                        value={p.thicknessIn ?? ""}
                        onChange={(e) =>
                          updatePart(i, {
                            thicknessIn: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 rounded border border-gray-200 text-right text-sm"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={saveToProject}
            disabled={saving || parts.every((p) => p.id)}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save parts to project"}
          </button>
        </>
      )}

      {project.panelParts.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-800">Saved parts ({project.panelParts.length})</h3>
          <p className="text-sm text-gray-600">Parts saved to this project appear above after you re-parse or refresh.</p>
        </div>
      )}
    </div>
  );
}
