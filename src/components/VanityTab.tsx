"use client";

import { useCallback, useMemo, useState } from "react";
import { computeVanitySelling } from "@/lib/pricing/vanity";
import { computeCountertop } from "@/lib/pricing/countertop";
import { formatCurrency } from "@/lib/format";
import { computeVanityIngredients } from "@/lib/ingredients/vanity";
import { computeConfigWarnings } from "@/lib/ingredients/warnings";
import { CABINET_DEFAULTS } from "@/lib/ingredients/types";
import { saveMaterialSnapshot } from "@/lib/ingredients/saveSnapshotClient";
import type { VanityInputs } from "@/lib/pricing/vanity";
import type { CountertopInputs } from "@/lib/pricing/countertop";
import type { VanitySection, VanitySectionLayout } from "@/lib/ingredients/types";
import { SectionConfigurator } from "./SectionConfigurator";
import { CabinetWireframe } from "./CabinetWireframe";
import { IngredientEstimatePanel } from "./IngredientEstimatePanel";
import toast from "react-hot-toast";

/**
 * Countertop overhang default (inches). Countertops traditionally overhang the
 * cabinet by a small amount on width/depth; making this a named constant keeps
 * the "Match vanity" button behaviour obvious.
 */
const COUNTERTOP_OVERHANG = 0.5;

type Project = {
  vanityInputs: Partial<VanityInputs> & {
    height?: number | null;
    countertop?: boolean;
    countertopWidth?: number | null;
    countertopDepth?: number | null;
    sinks?: string | null;
    faucetHoles?: string | null;
    priceRangePi2?: number | null;
    sections?: string | null;
  } | null;
};

const FRAMING = ["Sides only", "Sides and bottom", "Around", "Frame everything"] as const;
const MOUNTING = ["Freestanding", "Wall-hung", "Custom legs", "Box base"] as const;
const DOOR_STYLE = ["Slab/Flat", "Thin Shaker", "Standard Shaker"] as const;
const SINKS = ["Single", "Double"] as const;
const COUNTERTOP_SINKS = ["Single", "Double", "Single Vessel", "Double Vessel", "None"] as const;
const FAUCET_HOLES = ['4" center', '8" center', "One hole", "No Hole"] as const;

const defaultVanity: VanityInputs = {
  width: 24,
  depth: 22,
  kickplate: false,
  framingStyle: "Sides only",
  mountingStyle: "Freestanding",
  drawers: 0,
  doors: 0,
  thickFrame: false,
  numberOfSinks: "Single",
  doorStyle: "Slab/Flat",
};

function parseSections(json: string | null | undefined): VanitySection[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Section-canonical load: the refactored tab treats sections as the single
 * source of truth for layout. On first load we synthesise one implicit section
 * from whatever legacy flat doors/drawers data exists, so existing projects
 * keep working with zero user action.
 */
function loadInitialSections(
  v: Project["vanityInputs"],
  width: number
): VanitySection[] {
  const parsed = parseSections(v?.sections);
  if (parsed.length > 0) return parsed;
  const drawers = v?.drawers ?? 0;
  const doors = v?.doors ?? 0;
  const layout: VanitySectionLayout =
    drawers > 0 && doors > 0
      ? "drawer_over_doors"
      : drawers > 0
        ? "all_drawers"
        : doors > 0
          ? "doors"
          : "doors"; // default to doors for brand-new projects
  return [
    {
      id: `s${Date.now()}`,
      sortOrder: 0,
      layoutType: layout,
      width,
      doors: doors || (layout === "doors" ? 1 : 0),
      drawers,
    },
  ];
}

/**
 * Proportional rescale: when the user changes the total vanity width the
 * existing sections are scaled so their relative proportions are preserved
 * and they continue to sum to the new total. This prevents the "widths don't
 * match" conflict that used to appear when the total and the section sum
 * drifted apart.
 */
function rescaleSections(
  sections: VanitySection[],
  newTotal: number,
  minSection: number
): VanitySection[] {
  if (sections.length === 0) return sections;
  const currentTotal = sections.reduce((s, sec) => s + sec.width, 0);
  if (currentTotal <= 0) {
    // Distribute evenly
    const even = Math.max(minSection, newTotal / sections.length);
    return sections.map((s) => ({ ...s, width: even }));
  }
  const factor = newTotal / currentTotal;
  return sections.map((s) => ({
    ...s,
    width: Math.max(minSection, Math.round(s.width * factor * 4) / 4),
  }));
}

export function VanityTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const v = project.vanityInputs;
  const initialWidth = v?.width ?? 24;
  const [width, setWidthState] = useState(initialWidth);
  const [depth, setDepth] = useState(v?.depth ?? 22);
  const [height, setHeight] = useState<number | "">(v?.height ?? "");
  const [kickplate, setKickplate] = useState(v?.kickplate ?? false);
  const [framingStyle, setFramingStyle] = useState(v?.framingStyle ?? "Sides only");
  const [mountingStyle, setMountingStyle] = useState(v?.mountingStyle ?? "Freestanding");
  const [thickFrame, setThickFrame] = useState(v?.thickFrame ?? false);
  const [numberOfSinks, setNumberOfSinks] = useState<"Single" | "Double">(
    (v?.numberOfSinks as "Single" | "Double") ?? "Single"
  );
  const [doorStyle, setDoorStyle] = useState(v?.doorStyle ?? "Slab/Flat");
  const [countertop, setCountertop] = useState(v?.countertop ?? false);
  const [countertopWidth, setCountertopWidth] = useState(
    v?.countertopWidth ?? initialWidth + COUNTERTOP_OVERHANG
  );
  const [countertopDepth, setCountertopDepth] = useState(
    v?.countertopDepth ?? (v?.depth ?? 22) + COUNTERTOP_OVERHANG
  );
  const [sinks, setSinks] = useState(v?.sinks ?? "Single");
  const [faucetHoles, setFaucetHoles] = useState(v?.faucetHoles ?? "No Hole");
  const [priceRangePi2, setPriceRangePi2] = useState(v?.priceRangePi2 ?? 50);
  // Section-canonical layout: always at least one section. Legacy projects
  // with flat doors/drawers are synthesised into an implicit single section.
  const [sections, setSections] = useState<VanitySection[]>(() =>
    loadInitialSections(v, initialWidth)
  );
  const [saving, setSaving] = useState(false);

  // Width is source-of-truth; when it changes, the sections rescale to match.
  // Section widths now represent the modular-box slice (excluding the two
  // 3/4" finishing panels). So the sections sum to `width − 1.5"` rather
  // than `width`. The configurator's `totalDimension` is fed the inner
  // value for the same reason.
  const setWidth = useCallback((next: number) => {
    setWidthState(next);
    const innerTotal = Math.max(
      0,
      next - 2 * CABINET_DEFAULTS.finishPanelThickness
    );
    setSections((prev) =>
      rescaleSections(prev, innerTotal, CABINET_DEFAULTS.minSectionWidth)
    );
  }, []);

  // Derived totals — always come from sections now.
  const effectiveDoors = sections.reduce((s, sec) => s + sec.doors, 0);
  const effectiveDrawers = sections.reduce((s, sec) => s + sec.drawers, 0);

  const vanityInputs: VanityInputs = {
    width: Number(width) || 24,
    depth: Number(depth) || 22,
    kickplate,
    framingStyle: framingStyle as VanityInputs["framingStyle"],
    mountingStyle: mountingStyle as VanityInputs["mountingStyle"],
    drawers: effectiveDrawers,
    doors: effectiveDoors,
    thickFrame,
    numberOfSinks,
    doorStyle: doorStyle as VanityInputs["doorStyle"],
  };
  const vanityResult = computeVanitySelling(vanityInputs);
  const vanityTotal = vanityResult.total;

  const countertopInputs: CountertopInputs = {
    sinks: (countertop ? sinks : "None") as CountertopInputs["sinks"],
    faucetHoles: (faucetHoles as CountertopInputs["faucetHoles"]) || "No Hole",
    countertop,
    countertopWidth: countertop ? Number(countertopWidth) || 0 : 0,
    countertopDepth: countertop ? Number(countertopDepth) || 0 : 0,
    priceRangePi2: countertop ? Number(priceRangePi2) || 0 : 0,
  };
  const countertopResult = computeCountertop(countertopInputs);
  const countertopTotal = countertopResult.total;

  // Ingredient estimate (live, computed from current config)
  const ingredientEstimate = useMemo(() => {
    return computeVanityIngredients(
      {
        ...vanityInputs,
        height: height === "" ? undefined : height,
        sections,
      },
      { standards: CABINET_DEFAULTS }
    );
  }, [vanityInputs, height, sections]);

  // Effective height for wireframe
  const effectiveHeight =
    height === ""
      ? mountingStyle === "Wall-hung"
        ? CABINET_DEFAULTS.wallHungHeight
        : CABINET_DEFAULTS.defaultVanityHeight
      : height;

  // Config warnings — sections are always present so no fallback branch here.
  const warnings = useMemo(
    () =>
      computeConfigWarnings(
        {
          width: vanityInputs.width,
          depth: vanityInputs.depth,
          height: effectiveHeight,
          mountingStyle: vanityInputs.mountingStyle,
          kickplate: vanityInputs.kickplate,
          sections,
          numberOfSinks: vanityInputs.numberOfSinks,
          sinks: countertop ? sinks : undefined,
        },
        CABINET_DEFAULTS
      ),
    [vanityInputs, effectiveHeight, sections, countertop, sinks]
  );

  // Wireframe always reads directly from sections — no more legacy synthesis.
  const wireframeSections: VanitySection[] = sections;

  // Countertop is a candidate for "matches vanity?" check so we can show the
  // overhang reset button only when the user has deviated.
  const countertopIsOverhang =
    Math.abs(countertopWidth - (width + COUNTERTOP_OVERHANG)) < 0.01 &&
    Math.abs(countertopDepth - (depth + COUNTERTOP_OVERHANG)) < 0.01;
  const matchVanityCountertop = useCallback(() => {
    setCountertopWidth(width + COUNTERTOP_OVERHANG);
    setCountertopDepth(depth + COUNTERTOP_OVERHANG);
  }, [width, depth]);

  /**
   * Unified Save (Phase 5): persist the builder configuration AND refresh
   * the material snapshot in a single action. Previously these were two
   * separate buttons ("Save inputs" and "Save materials to project"),
   * which routinely left projects with drifted state when users forgot
   * the second button.
   */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/vanity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: vanityInputs.width,
          depth: vanityInputs.depth,
          height: height === "" ? null : height,
          kickplate: vanityInputs.kickplate,
          framingStyle: vanityInputs.framingStyle,
          mountingStyle: vanityInputs.mountingStyle,
          drawers: effectiveDrawers,
          doors: effectiveDoors,
          thickFrame: vanityInputs.thickFrame,
          numberOfSinks: vanityInputs.numberOfSinks,
          doorStyle: vanityInputs.doorStyle,
          countertop,
          countertopWidth: countertop ? countertopWidth : null,
          countertopDepth: countertop ? countertopDepth : null,
          sinks: countertop ? sinks : null,
          faucetHoles: countertop ? faucetHoles : null,
          priceRangePi2: countertop ? priceRangePi2 : null,
          sections: sections.length > 0 ? JSON.stringify(sections) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? "Could not save vanity configuration.");
        return;
      }
      // Inputs persisted — now regenerate the snapshot so materials stay
      // in lockstep with the saved config.
      const snap = await saveMaterialSnapshot(projectId, "vanity");
      if (!snap.ok) {
        toast.error(
          snap.error
            ? `Saved configuration, but materials did not refresh: ${snap.error}`
            : "Saved configuration, but materials did not refresh."
        );
      } else {
        toast.success("Vanity saved");
      }
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [
    projectId, vanityInputs, height, effectiveDoors, effectiveDrawers,
    countertop, countertopWidth, countertopDepth, sinks, faucetHoles,
    priceRangePi2, sections, onUpdate,
  ]);

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
            step={1}
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
            step={1}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Height (in) <span className="text-gray-400 text-xs">optional</span>
          </label>
          <input
            type="number"
            min={12}
            max={120}
            step={1}
            value={height}
            placeholder={mountingStyle === "Wall-hung" ? "24 (wall-hung)" : "30 (standard)"}
            onChange={(e) => setHeight(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="kickplate"
            checked={kickplate}
            onChange={(e) => setKickplate(e.target.checked)}
          />
          <label htmlFor="kickplate">Kickplate</label>
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
            id="thickFrame"
            checked={thickFrame}
            onChange={(e) => setThickFrame(e.target.checked)}
          />
          <label htmlFor="thickFrame">Thick frame</label>
        </div>
        {/* Vanity-level sinks are only meaningful without a countertop. When a
            countertop is enabled the sink config lives in the countertop block
            to avoid the duplicate/conflicting-info problem that used to exist. */}
        {!countertop && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Number of sinks</label>
            <select
              value={numberOfSinks}
              onChange={(e) => setNumberOfSinks(e.target.value as "Single" | "Double")}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              {SINKS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
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

      {/* Section Configurator */}
      <div className="border-t pt-4">
        <h3 className="mb-3 font-medium text-gray-800">Section Layout</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionConfigurator
            direction="horizontal"
            sections={sections}
            onSectionsChange={setSections}
            // Sections live inside the 2 finishing panels, so the usable
            // horizontal span is width − 2 × finishPanelThickness.
            totalDimension={Math.max(
              0,
              (Number(width) || 24) -
                2 * CABINET_DEFAULTS.finishPanelThickness
            )}
            minSection={CABINET_DEFAULTS.minSectionWidth}
          />
          <CabinetWireframe
            direction="horizontal"
            sections={wireframeSections}
            totalWidth={Number(width) || 24}
            totalHeight={effectiveHeight}
            kickplate={kickplate && mountingStyle !== "Wall-hung"}
            kickplateHeight={CABINET_DEFAULTS.kickplateHeight}
          />
        </div>
      </div>

      {/* Countertop */}
      <div className="border-t pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium text-gray-800">Countertop</h3>
          {countertop && !countertopIsOverhang && (
            <button
              type="button"
              onClick={matchVanityCountertop}
              className="text-xs text-[var(--accent-hover)] underline"
              title={`Reset to vanity size + ${COUNTERTOP_OVERHANG}" overhang`}
            >
              Match vanity
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="countertop"
            checked={countertop}
            onChange={(e) => {
              const next = e.target.checked;
              setCountertop(next);
              // Seed sensible defaults the first time countertop turns on.
              if (next) {
                setCountertopWidth(width + COUNTERTOP_OVERHANG);
                setCountertopDepth(depth + COUNTERTOP_OVERHANG);
              }
            }}
          />
          <label htmlFor="countertop">Include countertop</label>
        </div>
        {countertop && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Countertop width (in) <span className="text-gray-400 text-xs">default: vanity + {COUNTERTOP_OVERHANG}&quot;</span>
              </label>
              <input
                type="number"
                min={0}
                max={240}
                step={0.25}
                value={countertopWidth}
                onChange={(e) => setCountertopWidth(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Countertop depth (in) <span className="text-gray-400 text-xs">default: depth + {COUNTERTOP_OVERHANG}&quot;</span>
              </label>
              <input
                type="number"
                min={0}
                max={96}
                step={0.25}
                value={countertopDepth}
                onChange={(e) => setCountertopDepth(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sinks (countertop)</label>
              <select
                value={sinks}
                onChange={(e) => setSinks(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                {COUNTERTOP_SINKS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Faucet holes</label>
              <select
                value={faucetHoles}
                onChange={(e) => setFaucetHoles(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              >
                {FAUCET_HOLES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price range ($/sq ft)</label>
              <input
                type="number"
                min={0}
                max={1000}
                step={0.01}
                value={priceRangePi2}
                onChange={(e) => setPriceRangePi2(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="rounded bg-gray-50 p-4">
        <h3 className="mb-2 font-medium text-gray-800">Pricing</h3>
        <p className="text-lg">
          <span className="text-gray-600">Vanity selling total: </span>
          <strong>{formatCurrency(vanityTotal)}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(vanityTotal))}
            className="ml-2 rounded px-2 py-0.5 text-sm text-gray-500 hover:bg-gray-200"
            title="Copy value"
          >
            Copy
          </button>
        </p>
        <p className="text-lg">
          <span className="text-gray-600">Countertop total: </span>
          <strong>{formatCurrency(countertopTotal)}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(countertopTotal))}
            className="ml-2 rounded px-2 py-0.5 text-sm text-gray-500 hover:bg-gray-200"
            title="Copy value"
          >
            Copy
          </button>
        </p>
        <p className="mt-2 text-lg font-medium">
          <span className="text-gray-600">Combined: </span>
          {formatCurrency(vanityTotal + countertopTotal)}
        </p>
      </div>

      {/* Ingredient Estimate — the internal Save button is hidden because
          the parent tab now owns a unified Save that persists both the
          configuration and the material snapshot in one click. */}
      <div className="border-t pt-4">
        <IngredientEstimatePanel
          estimate={ingredientEstimate}
          warnings={warnings}
          projectId={projectId}
          sourceType="vanity"
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
