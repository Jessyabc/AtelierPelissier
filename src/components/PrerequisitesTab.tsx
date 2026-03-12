"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CutListTab } from "@/components/CutListTab";

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

type Cutlist = { id: string; name: string; sortOrder: number };
type ProjectItem = { id: string; label: string; type: string; cutlists?: Cutlist[] };
type PrerequisiteLine = {
  id: string;
  materialCode: string;
  category: string;
  quantity: number;
  needed: boolean;
  description?: string | null;
};
type SheetFmt = { lengthIn?: number; widthIn?: number; [key: string]: unknown };

type Project = {
  id: string;
  panelParts: PanelPart[];
  projectItems?: ProjectItem[];
  prerequisiteLines?: PrerequisiteLine[];
  materialRequirements?: { materialCode: string; requiredQty: number; allocatedQty: number }[];
  projectSettings?: { sheetFormat?: SheetFmt | null } | null;
};

const CATEGORIES = [
  { key: "finishing", label: "Finishing panels" },
  { key: "drawer_boxes", label: "Drawer boxes" },
  { key: "hinges", label: "Door hinges" },
  { key: "other", label: "Other" },
] as const;

export function PrerequisitesTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const [linesByCategory, setLinesByCategory] = useState<Record<string, PrerequisiteLine[]>>({});
  const [inventorySearch, setInventorySearch] = useState<Record<string, string>>({});
  const [inventoryResults, setInventoryResults] = useState<Record<string, { materialCode: string; description: string }[]>>({});
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addingCutlistForRoomId, setAddingCutlistForRoomId] = useState<string | null>(null);
  const [newCutlistName, setNewCutlistName] = useState("");
  const [saving, setSaving] = useState(false);

  const shortages = (project.materialRequirements ?? []).filter(
    (r) => r.allocatedQty < r.requiredQty
  );
  const shortageCount = shortages.length;

  useEffect(() => {
    const byCat: Record<string, PrerequisiteLine[]> = {};
    for (const c of CATEGORIES) byCat[c.key] = [];
    for (const line of project.prerequisiteLines ?? []) {
      if (byCat[line.category]) byCat[line.category].push(line);
    }
    setLinesByCategory(byCat);
  }, [project.prerequisiteLines]);

  const fetchLines = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/prerequisite-lines`);
    if (res.ok) {
      const data = await res.json();
      const byCat: Record<string, PrerequisiteLine[]> = {};
      for (const c of CATEGORIES) byCat[c.key] = [];
      for (const line of data) {
        if (byCat[line.category]) byCat[line.category].push(line);
      }
      setLinesByCategory(byCat);
    }
  }, [projectId]);

  const searchInventory = useCallback(async (category: string) => {
    const q = inventorySearch[category]?.trim();
    if (!q) return;
    const res = await fetch(`/api/inventory-items?q=${encodeURIComponent(q)}&limit=15`);
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];
      setInventoryResults((prev) => ({
        ...prev,
        [category]: items.map((i: { materialCode: string; description: string }) => ({
          materialCode: i.materialCode,
          description: i.description ?? "",
        })),
      }));
    }
  }, [inventorySearch]);

  const addLine = useCallback(
    async (category: string, materialCode: string, quantity: number) => {
      const res = await fetch(`/api/projects/${projectId}/prerequisite-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialCode, category, quantity, needed: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? "Failed to add");
        return;
      }
      setAddingCategory(null);
      setInventorySearch((prev) => ({ ...prev, [category]: "" }));
      setInventoryResults((prev) => ({ ...prev, [category]: [] }));
      await fetchLines();
      onUpdate();
      toast.success("Added");
    },
    [projectId, fetchLines, onUpdate]
  );

  const toggleNeeded = useCallback(
    async (lineId: string, needed: boolean) => {
      const res = await fetch(`/api/projects/${projectId}/prerequisite-lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needed }),
      });
      if (!res.ok) {
        toast.error("Failed to update");
        return;
      }
      await fetchLines();
      onUpdate();
    },
    [projectId, fetchLines, onUpdate]
  );

  const updateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      const res = await fetch(`/api/projects/${projectId}/prerequisite-lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        toast.error("Failed to update");
        return;
      }
      await fetchLines();
      onUpdate();
    },
    [projectId, fetchLines, onUpdate]
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      const res = await fetch(`/api/projects/${projectId}/prerequisite-lines/${lineId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to remove");
        return;
      }
      await fetchLines();
      onUpdate();
    },
    [projectId, fetchLines, onUpdate]
  );

  const addCutlist = useCallback(
    async (projectItemId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error("Enter a cutlist name");
        return;
      }
      const res = await fetch(`/api/projects/${projectId}/cutlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectItemId, name: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? "Failed to add cutlist");
        return;
      }
      setAddingCutlistForRoomId(null);
      setNewCutlistName("");
      onUpdate();
      toast.success("Cutlist added");
    },
    [projectId, onUpdate]
  );

  return (
    <div className="space-y-8">
      {/* When to order */}
      <div className="neo-card p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">When to order</h3>
        {shortageCount === 0 ? (
          <p className="text-sm text-emerald-600 font-medium">Materials covered for this project.</p>
        ) : (
          <p className="text-sm text-amber-700 font-medium">
            {shortageCount} material{shortageCount !== 1 ? "s" : ""} short — order or allocate to cover.
          </p>
        )}
        {shortages.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-[var(--foreground-muted)]">
            {shortages.slice(0, 5).map((r) => (
              <li key={r.materialCode}>
                {r.materialCode}: need {r.requiredQty}, allocated {r.allocatedQty}
              </li>
            ))}
            {shortages.length > 5 && <li>… and {shortages.length - 5} more</li>}
          </ul>
        )}
      </div>

      {/* Sheets / Cutlist — per room: material, sheet counts, parts (e.g. drawers) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Sheets / Cutlist</h2>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            Per room: add a cutlist for each room (e.g. Main Kitchen, Back Kitchen), then upload or paste parts to get material needed, number of sheets, and item counts.
          </p>
        </div>
        {(!project.projectItems || project.projectItems.length === 0) ? (
          <div className="neo-card p-4">
            <p className="text-sm text-[var(--foreground-muted)]">
              No rooms yet. Add rooms on the <strong>Overview</strong> tab (Timeline &amp; Rooms → &quot;+ Add Room&quot;), then return here to add a cutlist per room and enter material, sheet requirements, and items (e.g. drawers) for each.
            </p>
          </div>
        ) : (
          <>
            {project.projectItems.map((room) => (
              <div key={room.id} className="neo-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{room.label}</h3>
                  {addingCutlistForRoomId === room.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCutlistName}
                        onChange={(e) => setNewCutlistName(e.target.value)}
                        placeholder="e.g. Finishing, Framing"
                        className="neo-input w-40 px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => addCutlist(room.id, newCutlistName)}
                        className="neo-btn-primary px-2 py-1 text-xs"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingCutlistForRoomId(null); setNewCutlistName(""); }}
                        className="neo-btn px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingCutlistForRoomId(room.id)}
                      className="neo-btn px-2 py-1 text-xs"
                    >
                      + Add cutlist
                    </button>
                  )}
                </div>
                {(room.cutlists ?? []).length === 0 && addingCutlistForRoomId !== room.id ? (
                  <p className="text-xs text-[var(--foreground-muted)]">No cutlists yet. Click &quot;+ Add cutlist&quot; to add one (e.g. Finishing, Framing), then upload a PDF or paste parts to get material and sheet counts.</p>
                ) : (
                  (room.cutlists ?? []).map((cut) => {
                    const partsForCut = (project.panelParts ?? []).filter(
                      (p) => (p as PanelPart).cutlistId === cut.id
                    );
                    const projectForCut: Project = { ...project, panelParts: partsForCut };
                    return (
                      <div key={cut.id} className="neo-panel-inset p-3">
                        <h4 className="text-xs font-medium text-[var(--foreground-muted)] mb-2">{cut.name}</h4>
                        <CutListTab
                          projectId={projectId}
                          project={projectForCut}
                          onUpdate={onUpdate}
                          cutlistId={cut.id}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Prerequisite lines by category */}
      {CATEGORIES.map(({ key, label }) => (
        <div key={key} className="neo-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{label}</h3>
          <div className="space-y-2">
            {(linesByCategory[key] ?? []).map((line) => (
              <div
                key={line.id}
                className="flex flex-wrap items-center gap-3 py-2 border-b border-[var(--shadow-dark)]/10 last:border-0"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={line.needed}
                    onChange={() => toggleNeeded(line.id, !line.needed)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {line.description ?? line.materialCode}
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={line.quantity}
                  onChange={(e) => updateQuantity(line.id, parseFloat(e.target.value) || 0)}
                  className="neo-input w-20 px-2 py-1 text-sm text-right"
                />
                <span className="text-xs text-[var(--foreground-muted)]">{line.materialCode}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {addingCategory === key ? (
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <input
                type="text"
                placeholder="Search inventory by code or description..."
                value={inventorySearch[key] ?? ""}
                onChange={(e) => setInventorySearch((prev) => ({ ...prev, [key]: e.target.value }))}
                className="neo-input flex-1 min-w-[200px] px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => searchInventory(key)}
                className="neo-btn px-3 py-2 text-sm"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory(null);
                  setInventorySearch((prev) => ({ ...prev, [key]: "" }));
                  setInventoryResults((prev) => ({ ...prev, [key]: [] }));
                }}
                className="neo-btn px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCategory(key)}
              className="neo-btn px-3 py-1.5 text-xs"
            >
              + Add from inventory
            </button>
          )}
          {inventoryResults[key]?.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {inventoryResults[key].map((item) => (
                <li key={item.materialCode} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-[var(--foreground)]">
                    {item.materialCode} — {item.description}
                  </span>
                  <button
                    type="button"
                    onClick={() => addLine(key, item.materialCode, 1)}
                    className="neo-btn-primary px-2 py-0.5 text-xs"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
