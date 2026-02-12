"use client";

import { useCallback, useState } from "react";
import { computeSideUnitSelling } from "@/lib/pricing/sideUnit";
import { formatCurrency } from "@/lib/format";
import type { SideUnitInputs } from "@/lib/pricing/sideUnit";

type Project = {
  sideUnitInputs: Partial<SideUnitInputs> | null;
};

const FRAMING = ["Sides only", "Sides and bottom", "Around", "Frame everything"] as const;
const MOUNTING = ["Freestanding", "Wall-hung", "Custom legs", "Box base"] as const;
const DOOR_STYLE = ["Slab/Flat", "Thin Shaker", "Standard Shaker"] as const;

export function SideUnitTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const v = project.sideUnitInputs;
  const [width, setWidth] = useState(v?.width ?? 18);
  const [depth, setDepth] = useState(v?.depth ?? 16);
  const [height, setHeight] = useState(v?.height ?? 72);
  const [kickplate, setKickplate] = useState(v?.kickplate ?? false);
  const [framingStyle, setFramingStyle] = useState(v?.framingStyle ?? "Sides only");
  const [mountingStyle, setMountingStyle] = useState(v?.mountingStyle ?? "Freestanding");
  const [drawers, setDrawers] = useState(v?.drawers ?? 0);
  const [doors, setDoors] = useState(v?.doors ?? 0);
  const [thickFrame, setThickFrame] = useState(v?.thickFrame ?? false);
  const [doorStyle, setDoorStyle] = useState(v?.doorStyle ?? "Slab/Flat");
  const [saving, setSaving] = useState(false);

  const inputs: SideUnitInputs = {
    width: Number(width) || 18,
    depth: Number(depth) || 16,
    height: Number(height) || 72,
    kickplate,
    framingStyle: framingStyle as SideUnitInputs["framingStyle"],
    mountingStyle: mountingStyle as SideUnitInputs["mountingStyle"],
    drawers: Math.max(0, Number(drawers) || 0),
    doors: Math.max(0, Number(doors) || 0),
    thickFrame,
    doorStyle: doorStyle as SideUnitInputs["doorStyle"],
  };
  const sideUnitTotal = computeSideUnitSelling(inputs).total;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/side-unit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projectId, inputs, onUpdate]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width (in)</label>
          <input
            type="number"
            min={12}
            max={120}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Depth (in)</label>
          <input
            type="number"
            min={12}
            max={48}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Height (in)</label>
          <input
            type="number"
            min={24}
            max={120}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="su-kickplate"
            checked={kickplate}
            onChange={(e) => setKickplate(e.target.checked)}
          />
          <label htmlFor="su-kickplate">Kickplate</label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Framing style</label>
          <select
            value={framingStyle}
            onChange={(e) => setFramingStyle(e.target.value as (typeof FRAMING)[number])}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            {FRAMING.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Mounting style</label>
          <select
            value={mountingStyle}
            onChange={(e) => setMountingStyle(e.target.value as (typeof MOUNTING)[number])}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            {MOUNTING.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Drawers</label>
          <input
            type="number"
            min={0}
            max={20}
            value={drawers}
            onChange={(e) => setDrawers(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Doors</label>
          <input
            type="number"
            min={0}
            max={20}
            value={doors}
            onChange={(e) => setDoors(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="su-thickFrame"
            checked={thickFrame}
            onChange={(e) => setThickFrame(e.target.checked)}
          />
          <label htmlFor="su-thickFrame">Thick frame</label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Door style</label>
          <select
            value={doorStyle}
            onChange={(e) => setDoorStyle(e.target.value as (typeof DOOR_STYLE)[number])}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            {DOOR_STYLE.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded bg-gray-50 p-4">
        <h3 className="mb-2 font-medium text-gray-800">Pricing</h3>
        <p className="text-lg">
          <span className="text-gray-600">Side unit selling total: </span>
          <strong>{formatCurrency(sideUnitTotal)}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(sideUnitTotal))}
            className="ml-2 rounded px-2 py-0.5 text-sm text-gray-500 hover:bg-gray-200"
            title="Copy value"
          >
            Copy
          </button>
        </p>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save inputs"}
      </button>
    </div>
  );
}
