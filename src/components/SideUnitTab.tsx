"use client";

import { useCallback, useMemo, useState } from "react";
import { computeSideUnitSelling } from "@/lib/pricing/sideUnit";
import { formatCurrency } from "@/lib/format";
import { computeSideUnitIngredients } from "@/lib/ingredients/sideUnit";
import { computeConfigWarnings } from "@/lib/ingredients/warnings";
import { CABINET_DEFAULTS } from "@/lib/ingredients/types";
import type { SideUnitInputs } from "@/lib/pricing/sideUnit";
import type { SideUnitSection } from "@/lib/ingredients/types";
import { SectionConfigurator } from "./SectionConfigurator";
import { CabinetWireframe } from "./CabinetWireframe";
import { IngredientEstimatePanel } from "./IngredientEstimatePanel";
import { saveMaterialSnapshot } from "@/lib/ingredients/saveSnapshotClient";
import toast from "react-hot-toast";

type Project = {
  sideUnitInputs: (Partial<SideUnitInputs> & { sections?: string | null }) | null;
};

const FRAMING = ["Sides only", "Sides and bottom", "Around", "Frame everything"] as const;
const MOUNTING = ["Freestanding", "Wall-hung", "Custom legs", "Box base"] as const;
const DOOR_STYLE = ["Slab/Flat", "Thin Shaker", "Standard Shaker"] as const;

function parseSections(json: string | null | undefined): SideUnitSection[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const [sections, setSections] = useState<SideUnitSection[]>(() => {
    const parsed = parseSections(v?.sections);
    return parsed.length > 0 ? parsed : [];
  });
  const [saving, setSaving] = useState(false);

  // Derive flat counts from sections for pricing
  const sectionDoors = sections.reduce((s, sec) => s + sec.doors, 0);
  const sectionDrawers = sections.reduce((s, sec) => s + sec.drawers, 0);
  const effectiveDoors = sections.length > 0 ? sectionDoors : doors;
  const effectiveDrawers = sections.length > 0 ? sectionDrawers : drawers;

  const inputs: SideUnitInputs = {
    width: Number(width) || 18,
    depth: Number(depth) || 16,
    height: Number(height) || 72,
    kickplate,
    framingStyle: framingStyle as SideUnitInputs["framingStyle"],
    mountingStyle: mountingStyle as SideUnitInputs["mountingStyle"],
    drawers: effectiveDrawers,
    doors: effectiveDoors,
    thickFrame,
    doorStyle: doorStyle as SideUnitInputs["doorStyle"],
  };
  const sideUnitTotal = computeSideUnitSelling(inputs).total;

  // Ingredient estimate (live)
  const ingredientEstimate = useMemo(() => {
    return computeSideUnitIngredients(
      {
        ...inputs,
        sections: sections.length > 0 ? sections : undefined,
      },
      { standards: CABINET_DEFAULTS }
    );
  }, [inputs, sections]);

  // Config warnings
  const warnings = useMemo(
    () =>
      computeConfigWarnings(
        {
          width: inputs.width,
          depth: inputs.depth,
          height: inputs.height,
          mountingStyle: inputs.mountingStyle,
          kickplate: inputs.kickplate,
          sections: sections.length > 0 ? sections : undefined,
        },
        CABINET_DEFAULTS
      ),
    [inputs, sections]
  );

  // Wireframe sections
  const wireframeSections: SideUnitSection[] = useMemo(() => {
    if (sections.length > 0) return sections;
    const interiorH =
      inputs.height -
      (kickplate && mountingStyle !== "Wall-hung" ? CABINET_DEFAULTS.kickplateHeight : 0) -
      2 * CABINET_DEFAULTS.panelThickness;
    return [
      {
        id: "__flat__",
        sortOrder: 0,
        layoutType:
          effectiveDrawers > 0
            ? "drawers"
            : effectiveDoors > 0
              ? "doors"
              : "open",
        height: interiorH,
        doors: effectiveDoors,
        drawers: effectiveDrawers,
      },
    ];
  }, [sections, inputs.height, kickplate, mountingStyle, effectiveDoors, effectiveDrawers]);

  /**
   * Unified Save (Phase 5): persist side-unit configuration and refresh
   * the material snapshot in one click — same model as VanityTab.
   */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/side-unit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputs,
          sections: sections.length > 0 ? JSON.stringify(sections) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? "Could not save side unit configuration.");
        return;
      }
      const snap = await saveMaterialSnapshot(projectId, "side_unit");
      if (!snap.ok) {
        toast.error(
          snap.error
            ? `Saved configuration, but materials did not refresh: ${snap.error}`
            : "Saved configuration, but materials did not refresh."
        );
      } else {
        toast.success("Side unit saved");
      }
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projectId, inputs, sections, onUpdate]);

  return (
    <div className="space-y-6">
      {/* Global settings */}
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

        {/* Legacy flat doors/drawers — shown only when no sections configured */}
        {sections.length === 0 && (
          <>
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
          </>
        )}
      </div>

      {/* Section Configurator */}
      <div className="border-t pt-4">
        <h3 className="mb-3 font-medium text-gray-800">Section Layout</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionConfigurator
            direction="vertical"
            sections={sections}
            onSectionsChange={setSections}
            totalDimension={Number(height) || 72}
            minSection={CABINET_DEFAULTS.minSectionHeight}
          />
          <CabinetWireframe
            direction="vertical"
            sections={wireframeSections}
            totalWidth={Number(width) || 18}
            totalHeight={Number(height) || 72}
            kickplate={kickplate && mountingStyle !== "Wall-hung"}
            kickplateHeight={CABINET_DEFAULTS.kickplateHeight}
          />
        </div>
      </div>

      {/* Pricing */}
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

      {/* Ingredient Estimate — internal Save hidden, parent drives unified save */}
      <div className="border-t pt-4">
        <IngredientEstimatePanel
          estimate={ingredientEstimate}
          warnings={warnings}
          projectId={projectId}
          sourceType="side_unit"
          onSaved={onUpdate}
          hideInternalSave
        />
      </div>

      {/* Unified Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="text-xs text-gray-500">
          Saves configuration and refreshes the material snapshot together.
        </span>
      </div>
    </div>
  );
}
