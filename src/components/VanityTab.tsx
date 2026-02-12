"use client";

import { useCallback, useState } from "react";
import { computeVanitySelling } from "@/lib/pricing/vanity";
import { computeCountertop } from "@/lib/pricing/countertop";
import { formatCurrency } from "@/lib/format";
import type { VanityInputs } from "@/lib/pricing/vanity";
import type { CountertopInputs } from "@/lib/pricing/countertop";

type Project = {
  vanityInputs: Partial<VanityInputs> & {
    countertop?: boolean;
    countertopWidth?: number | null;
    countertopDepth?: number | null;
    sinks?: string | null;
    faucetHoles?: string | null;
    priceRangePi2?: number | null;
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
  const [width, setWidth] = useState(v?.width ?? 24);
  const [depth, setDepth] = useState(v?.depth ?? 22);
  const [kickplate, setKickplate] = useState(v?.kickplate ?? false);
  const [framingStyle, setFramingStyle] = useState(v?.framingStyle ?? "Sides only");
  const [mountingStyle, setMountingStyle] = useState(v?.mountingStyle ?? "Freestanding");
  const [drawers, setDrawers] = useState(v?.drawers ?? 0);
  const [doors, setDoors] = useState(v?.doors ?? 0);
  const [thickFrame, setThickFrame] = useState(v?.thickFrame ?? false);
  const [numberOfSinks, setNumberOfSinks] = useState<"Single" | "Double">(
    (v?.numberOfSinks as "Single" | "Double") ?? "Single"
  );
  const [doorStyle, setDoorStyle] = useState(v?.doorStyle ?? "Slab/Flat");
  const [countertop, setCountertop] = useState(v?.countertop ?? false);
  const [countertopWidth, setCountertopWidth] = useState(v?.countertopWidth ?? 48);
  const [countertopDepth, setCountertopDepth] = useState(v?.countertopDepth ?? 24);
  const [sinks, setSinks] = useState(v?.sinks ?? "None");
  const [faucetHoles, setFaucetHoles] = useState(v?.faucetHoles ?? "No Hole");
  const [priceRangePi2, setPriceRangePi2] = useState(v?.priceRangePi2 ?? 50);
  const [saving, setSaving] = useState(false);

  const vanityInputs: VanityInputs = {
    width: Number(width) || 24,
    depth: Number(depth) || 22,
    kickplate,
    framingStyle: framingStyle as VanityInputs["framingStyle"],
    mountingStyle: mountingStyle as VanityInputs["mountingStyle"],
    drawers: Math.max(0, Number(drawers) || 0),
    doors: Math.max(0, Number(doors) || 0),
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

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/vanity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: vanityInputs.width,
          depth: vanityInputs.depth,
          kickplate: vanityInputs.kickplate,
          framingStyle: vanityInputs.framingStyle,
          mountingStyle: vanityInputs.mountingStyle,
          drawers: vanityInputs.drawers,
          doors: vanityInputs.doors,
          thickFrame: vanityInputs.thickFrame,
          numberOfSinks: vanityInputs.numberOfSinks,
          doorStyle: vanityInputs.doorStyle,
          countertop,
          countertopWidth: countertop ? countertopWidth : null,
          countertopDepth: countertop ? countertopDepth : null,
          sinks: countertop ? sinks : null,
          faucetHoles: countertop ? faucetHoles : null,
          priceRangePi2: countertop ? priceRangePi2 : null,
        }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projectId, vanityInputs, countertop, countertopWidth, countertopDepth, sinks, faucetHoles, priceRangePi2, onUpdate]);

  return (
    <div className="space-y-6">
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
            id="thickFrame"
            checked={thickFrame}
            onChange={(e) => setThickFrame(e.target.checked)}
          />
          <label htmlFor="thickFrame">Thick frame</label>
        </div>
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

      <div className="border-t pt-4">
        <h3 className="mb-2 font-medium text-gray-800">Countertop</h3>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="countertop"
            checked={countertop}
            onChange={(e) => setCountertop(e.target.checked)}
          />
          <label htmlFor="countertop">Include countertop</label>
        </div>
        {countertop && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Countertop width (in)</label>
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Countertop depth (in)</label>
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
