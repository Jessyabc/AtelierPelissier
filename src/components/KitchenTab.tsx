"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_KITCHEN_MARKUP } from "@/config/kitchenPricingBuilder";
import { autoCalculateHardware } from "@/lib/kitchen-pricing/engine";
import type {
  KitchenCabinetConfiguration,
  KitchenCabinetInput,
  KitchenCabinetType,
  KitchenDoorManufacturerId,
  KitchenDoorStyleId,
  KitchenDrawerSystemId,
} from "@/lib/kitchen-pricing/types";
import { canUserSeeBreakdown, isKitchenManagerRole } from "@/lib/kitchen-pricing/permissions";
import { type KitchenRoomDefaults, usableBaseCabinetOpeningInches } from "@/lib/kitchen-pricing/roomDefaults";
import { ConstructionStandardField } from "@/components/standards/ConstructionStandardField";
import { StandardsProvider, useStandardsContext } from "@/components/standards/StandardsContext";

type Project = {
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number } | null;
  costLines: Array<{ id: string; kind: string; category: string; amount: number }>;
};

type KitchenBuilderPayload = {
  cabinets: KitchenCabinetInput[];
  roomDefaults: KitchenRoomDefaults;
  includeInstallation: boolean;
  installation: {
    baseCabinetQty: number;
    wallCabinetQty: number;
    pantryQty: number;
    finishingPanelQty: number;
  };
  includeDelivery: boolean;
  deliveryCost?: number | null;
  multiplier: number;
  discountPercent: number;
  discountReason?: string | null;
};

type KitchenBuilderResponse = {
  payload: KitchenBuilderPayload;
  shopRoomDefaults: KitchenRoomDefaults;
  totals: {
    materialsSubtotal: number;
    fabricationSubtotal: number;
    installationSubtotal: number;
    deliverySubtotal: number;
    totalCost: number;
  } | null;
  sales: {
    totalCost: number;
    multiplier: number;
    salesPriceRaw: number;
    discountPercent: number;
    discountAmount: number;
    finalSalesPrice: number;
  };
  visibility: { canSeeBreakdown: boolean; role: string };
  approval: {
    status: "not_required" | "required" | "pending" | "approved" | "rejected";
    reason: string | null;
    submittedAt: string | null;
    submittedByRole: string | null;
    approvedAt: string | null;
    approvedByRole: string | null;
  } | null;
};

type DraftCabinet = {
  cabinetType: KitchenCabinetType;
  configuration: KitchenCabinetConfiguration;
  doorCount: number;
  drawerCount: number;
  doorManufacturerId: KitchenDoorManufacturerId;
  doorStyleId: KitchenDoorStyleId;
  doorWidthInches: number;
  doorHeightInches: number;
  drawerSystemId: KitchenDrawerSystemId;
  cabinetBoxMaterialId: "melamine_white" | "melamine_grey";
  cabinetBoxQuantity: number;
  manualFabricationHours: number | "";
};

const INITIAL_DRAFT: DraftCabinet = {
  cabinetType: "base",
  configuration: "doors_only",
  doorCount: 2,
  drawerCount: 0,
  doorManufacturerId: "richelieu_agt",
  doorStyleId: "shaker_3_4",
  doorWidthInches: 18,
  doorHeightInches: 32,
  drawerSystemId: "blum_merivo_box",
  cabinetBoxMaterialId: "melamine_white",
  cabinetBoxQuantity: 1,
  manualFabricationHours: "",
};

type KitchenTabProps = {
  projectId: string;
  project: Project;
  onUpdate: () => void;
};

function cabinetLabel(c: KitchenCabinetInput): string {
  const t = c.cabinetType.replaceAll("_", " ");
  const doors = c.doors.reduce((s, d) => s + d.quantity, 0);
  const drawers = c.drawers.reduce((s, d) => s + d.quantity, 0);
  if (doors === 0 && drawers === 0) return t;
  if (doors > 0 && drawers > 0) return `${t} · ${doors}D/${drawers}Dr`;
  if (doors > 0) return `${t} · ${doors}D`;
  return `${t} · ${drawers}Dr`;
}

function clampIdx(idx: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(max - 1, idx));
}

function KitchenTabInner({ projectId, project: _project, onUpdate }: KitchenTabProps) {
  const { resolve, loading: standardsLoading, refresh } = useStandardsContext();
  const [data, setData] = useState<KitchenBuilderResponse | null>(null);
  const [payload, setPayload] = useState<KitchenBuilderPayload | null>(null);
  const [shopRoomDefaults, setShopRoomDefaults] = useState<KitchenRoomDefaults | null>(null);
  const [draft, setDraft] = useState<DraftCabinet>(INITIAL_DRAFT);
  const [role, setRole] = useState("salesperson");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [error, setError] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [builderRes, meRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/kitchen-builder`),
        fetch("/api/auth/me"),
      ]);
      if (!builderRes.ok) throw new Error("Could not load kitchen builder.");
      const builderData = (await builderRes.json()) as KitchenBuilderResponse;
      const meData = await meRes.json();
      setData(builderData);
      setPayload(builderData.payload);
      setShopRoomDefaults(builderData.shopRoomDefaults ?? null);
      setRole(meData?.user?.role ?? "salesperson");
      setFocusIdx((prev) => clampIdx(prev, builderData.payload?.cabinets?.length ?? 0));
    } catch {
      setError("Failed to load kitchen builder.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCabinet = () => {
    if (!payload) return;
    const hw = autoCalculateHardware(
      draft.cabinetType,
      draft.configuration,
      draft.doorCount,
      draft.drawerCount
    );
    const cabinet: KitchenCabinetInput = {
      cabinetType: draft.cabinetType,
      configuration: draft.configuration,
      doors:
        draft.doorCount > 0
          ? [
              {
                widthInches: draft.doorWidthInches,
                heightInches: draft.doorHeightInches,
                quantity: draft.doorCount,
                manufacturerId: draft.doorManufacturerId,
                styleId: draft.doorStyleId,
              },
            ]
          : [],
      drawers:
        draft.drawerCount > 0
          ? [{ drawerSystemId: draft.drawerSystemId, quantity: draft.drawerCount }]
          : [],
      hardware: {
        standardHinges: hw.standardHinges.recommended,
        verticalHinges: 0,
        handleTypeId: "standard_handle",
        handleQuantity: hw.handles.recommended,
        pattes: hw.pattes.recommended,
        ledQuantity: 0,
        wasteBinQuantity: 0,
      },
      cabinetBoxMaterialId: draft.cabinetBoxMaterialId,
      cabinetBoxQuantity: draft.cabinetBoxQuantity,
      manualFabricationHours:
        draft.configuration === "custom" ? Number(draft.manualFabricationHours || 0) : null,
    };
    setPayload({ ...payload, cabinets: [...payload.cabinets, cabinet] });
    setDraft(INITIAL_DRAFT);
    setFocusIdx(payload.cabinets.length);
  };

  const removeCabinet = (index: number) => {
    if (!payload) return;
    setPayload({
      ...payload,
      cabinets: payload.cabinets.filter((_, i) => i !== index),
    });
    setFocusIdx((prev) => clampIdx(prev, payload.cabinets.length - 1));
  };

  function scrollToIdx(nextIdx: number) {
    const el = carouselRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-cabinet-idx="${nextIdx}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  function setFocus(nextIdx: number) {
    if (!payload) return;
    const clamped = clampIdx(nextIdx, payload.cabinets.length);
    setFocusIdx(clamped);
    scrollToIdx(clamped);
  }

  function updateCabinet(idx: number, patch: Partial<KitchenCabinetInput>) {
    if (!payload) return;
    setPayload({
      ...payload,
      cabinets: payload.cabinets.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  }

  const saveBuilder = useCallback(async () => {
    if (!payload) return;
    setSaving(true);
    setError("");
    try {
      const roomDefaults: KitchenRoomDefaults = {
        ceilingHeightInches: payload.roomDefaults.ceilingHeightInches,
        baseCabinetHeightInches: resolve("kitchenBaseHeight").value,
        baseCabinetDepthInches: resolve("kitchenBaseDepth").value,
        kickplateHeightInches: resolve("kitchenKickplateHeight").value,
        topCabinetSilenceInches: resolve("kitchenTopSilenceHeight").value,
      };
      const body = { ...payload, roomDefaults };
      const res = await fetch(`/api/projects/${projectId}/kitchen-builder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Partial<KitchenBuilderResponse> & { error?: string };
      if (!res.ok) {
        setError(json?.error ?? "Could not save kitchen builder.");
        return;
      }
      if (json.payload) {
        setPayload(json.payload);
      }
      setData((prev) => (prev ? { ...prev, ...json } : (json as KitchenBuilderResponse)));
      void refresh();
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [payload, projectId, onUpdate, resolve, refresh]);

  const submitBuilder = async () => {
    setSubmitting(true);
    setError("");
    try {
      await saveBuilder();
      const res = await fetch(`/api/projects/${projectId}/kitchen-builder/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok && res.status !== 409) {
        setError(json?.error ?? "Failed to submit kitchen quote.");
      }
      await load();
      onUpdate();
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (status: "approved" | "rejected") => {
    setApprovalBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/kitchen-builder/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Approval update failed.");
      }
      await load();
      onUpdate();
    } finally {
      setApprovalBusy(false);
    }
  };

  const canSeeBreakdown = useMemo(() => canUserSeeBreakdown(role), [role]);

  if (loading || !payload || !data) {
    return <p className="text-sm text-gray-500">Loading kitchen builder...</p>;
  }

  const rd = payload.roomDefaults;
  const baseOpeningIn = usableBaseCabinetOpeningInches({
    ...rd,
    baseCabinetHeightInches: resolve("kitchenBaseHeight").value,
    kickplateHeightInches: resolve("kitchenKickplateHeight").value,
  });

  return (
    <div className="space-y-6 pb-28">
      <p className="text-sm text-gray-600">
        Build cabinets from structured inputs, auto-calculate costs, then submit for approval if the multiplier differs
        from the default.
      </p>

      <div
        className={`rounded border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 transition-opacity ${
          standardsLoading ? "opacity-70" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Step 1 — Room defaults</h3>
            <p className="text-xs text-gray-600 mt-1 max-w-prose">
              Ceiling is per room. Base height, depth, kick, and top silence come from shop construction standards — change
              a value and you&apos;ll be asked for a reason if it needs planner/admin approval. Saving the builder stores
              the effective numbers on this quote.
            </p>
          </div>
          {shopRoomDefaults && (
            <button
              type="button"
              onClick={() => {
                setPayload({ ...payload, roomDefaults: { ...shopRoomDefaults } });
                void refresh();
              }}
              className="shrink-0 text-xs font-medium text-emerald-900 underline hover:no-underline"
            >
              Reset saved snapshot to shop defaults
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-gray-600">
            <span>Ceiling height (in)</span>
            <input
              type="number"
              step={0.125}
              min={72}
              max={168}
              value={rd.ceilingHeightInches}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  roomDefaults: { ...rd, ceilingHeightInches: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
          <ConstructionStandardField
            standardKey="kitchenBaseHeight"
            label="Base cabinet height"
            hint="Shop default; override triggers review if policy says so."
          />
          <ConstructionStandardField
            standardKey="kitchenBaseDepth"
            label="Base cabinet depth"
            hint="Typically 23⅜″ carcass depth."
          />
          <ConstructionStandardField
            standardKey="kitchenKickplateHeight"
            label="Kick / toe"
            hint="Toe space under base cabinets."
          />
          <ConstructionStandardField
            standardKey="kitchenTopSilenceHeight"
            label="Top silence"
            hint="Space above wall cabinets to ceiling on tall runs."
          />
        </div>
        <p className="text-xs text-gray-600">
          Usable base opening (doors/drawers): <strong>{baseOpeningIn} in</strong>
          <span className="text-gray-500"> — effective base height minus kick (from standards / approved overrides)</span>
        </p>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Step 2 — Cabinets</h3>
            <p className="text-xs text-gray-600 mt-1">
              Swipe left/right to move through cabinets. Use the minimap to jump.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFocus(focusIdx - 1)}
              disabled={payload.cabinets.length === 0 || focusIdx <= 0}
              className="neo-btn px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setFocus(focusIdx + 1)}
              disabled={payload.cabinets.length === 0 || focusIdx >= payload.cabinets.length - 1}
              className="neo-btn px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Minimap */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {payload.cabinets.length === 0 ? (
            <span className="text-xs text-gray-500">No cabinets yet. Add the first one below.</span>
          ) : (
            payload.cabinets.map((c, idx) => (
              <button
                key={`${c.cabinetType}-${idx}`}
                type="button"
                onClick={() => setFocus(idx)}
                className={
                  idx === focusIdx
                    ? "neo-btn-pressed px-3 py-1.5 text-xs whitespace-nowrap"
                    : "neo-btn px-3 py-1.5 text-xs whitespace-nowrap"
                }
                title={cabinetLabel(c)}
              >
                {idx + 1}
              </button>
            ))
          )}
        </div>

        {/* Reading-book carousel */}
        {payload.cabinets.length > 0 && (
          <div
            ref={carouselRef}
            className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
          >
            {payload.cabinets.map((c, idx) => {
              const doors = c.doors.reduce((s, d) => s + d.quantity, 0);
              const drawers = c.drawers.reduce((s, d) => s + d.quantity, 0);
              const isFocused = idx === focusIdx;
              return (
                <div
                  key={`${c.cabinetType}-${idx}`}
                  data-cabinet-idx={idx}
                  className={`min-w-[88%] sm:min-w-[540px] snap-start rounded border bg-white p-4 ${
                    isFocused ? "border-[var(--accent)] shadow-sm" : "border-gray-200"
                  }`}
                  onClick={() => setFocus(idx)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Cabinet {idx + 1}</div>
                      <div className="text-sm font-semibold text-gray-900">{cabinetLabel(c)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCabinet(idx);
                      }}
                      className="text-xs text-red-700 underline hover:no-underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-gray-600">
                      <span>Type</span>
                      <select
                        value={c.cabinetType}
                        onChange={(e) =>
                          updateCabinet(idx, { cabinetType: e.target.value as KitchenCabinetType })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      >
                        <option value="base">Base</option>
                        <option value="wall">Wall</option>
                        <option value="pantry">Pantry</option>
                        <option value="corner_base">Corner Base</option>
                        <option value="corner_wall">Corner Wall</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-xs text-gray-600">
                      <span>Configuration</span>
                      <select
                        value={c.configuration}
                        onChange={(e) =>
                          updateCabinet(idx, { configuration: e.target.value as KitchenCabinetConfiguration })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      >
                        <option value="doors_only">Doors only</option>
                        <option value="doors_and_drawers">Doors + drawers</option>
                        <option value="drawers_only">Drawers only</option>
                        <option value="corner_doors">Corner (doors)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>

                    <div className="rounded border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Quick counts</div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span>Doors</span>
                        <strong>{doors}</strong>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span>Drawers</span>
                        <strong>{drawers}</strong>
                      </div>
                    </div>

                    <div className="rounded border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Box qty</div>
                      <input
                        type="number"
                        min={1}
                        value={c.cabinetBoxQuantity}
                        onChange={(e) =>
                          updateCabinet(idx, { cabinetBoxQuantity: Number(e.target.value) || 1 })
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details className="rounded border border-gray-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-800">
            Add a cabinet
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={draft.cabinetType}
            onChange={(e) => setDraft({ ...draft, cabinetType: e.target.value as KitchenCabinetType })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="base">Base</option>
            <option value="wall">Wall</option>
            <option value="pantry">Pantry</option>
            <option value="corner_base">Corner Base</option>
            <option value="corner_wall">Corner Wall</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={draft.configuration}
            onChange={(e) =>
              setDraft({ ...draft, configuration: e.target.value as KitchenCabinetConfiguration })
            }
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="doors_only">Doors only</option>
            <option value="doors_and_drawers">Doors + drawers</option>
            <option value="drawers_only">Drawers only</option>
            <option value="corner_doors">Corner (doors)</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="number"
            min={0}
            value={draft.doorCount}
            onChange={(e) => setDraft({ ...draft, doorCount: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Door count"
          />
          <input
            type="number"
            min={0}
            value={draft.drawerCount}
            onChange={(e) => setDraft({ ...draft, drawerCount: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Drawer count"
          />
          <select
            value={draft.doorManufacturerId}
            onChange={(e) =>
              setDraft({ ...draft, doorManufacturerId: e.target.value as KitchenDoorManufacturerId })
            }
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="richelieu_agt">AGT</option>
            <option value="richelieu_panexel">Panexel</option>
          </select>
          <select
            value={draft.doorStyleId}
            onChange={(e) => setDraft({ ...draft, doorStyleId: e.target.value as KitchenDoorStyleId })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="shaker_3_4">Shaker 3/4</option>
            <option value="slab">Slab</option>
            <option value="shaker_2_1_4">Shaker 2 1/4</option>
          </select>
          <input
            type="number"
            min={1}
            value={draft.doorWidthInches}
            onChange={(e) => setDraft({ ...draft, doorWidthInches: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Door width in"
          />
          <input
            type="number"
            min={1}
            value={draft.doorHeightInches}
            onChange={(e) => setDraft({ ...draft, doorHeightInches: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Door height in"
          />
          <select
            value={draft.drawerSystemId}
            onChange={(e) => setDraft({ ...draft, drawerSystemId: e.target.value as KitchenDrawerSystemId })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="rocheleau_basic">Rocheleau</option>
            <option value="blum_merivo_box">Blum Merivo</option>
            <option value="blum_push_slow_close">Blum Push Slow</option>
            <option value="rocheleau_light">Rocheleau Light</option>
          </select>
          <select
            value={draft.cabinetBoxMaterialId}
            onChange={(e) =>
              setDraft({ ...draft, cabinetBoxMaterialId: e.target.value as "melamine_white" | "melamine_grey" })
            }
            className="rounded border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="melamine_white">Melamine White</option>
            <option value="melamine_grey">Melamine Grey</option>
          </select>
          <input
            type="number"
            min={1}
            value={draft.cabinetBoxQuantity}
            onChange={(e) => setDraft({ ...draft, cabinetBoxQuantity: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Box qty"
          />
          <input
            type="number"
            min={0}
            step={0.25}
            value={draft.manualFabricationHours}
            onChange={(e) =>
              setDraft({
                ...draft,
                manualFabricationHours: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="rounded border border-gray-300 px-2 py-2 text-sm"
            placeholder="Manual hours (custom)"
          />
        </div>
        <button
          type="button"
          onClick={addCabinet}
          className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Add cabinet
        </button>
          </div>
        </details>
      </div>

      {/* Legacy table view (kept for now as a fallback / quick scan). */}
      <table className="w-full border-collapse border border-gray-200 text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left">Cabinet</th>
            <th className="border border-gray-200 px-3 py-2 text-left">Config</th>
            <th className="border border-gray-200 px-3 py-2 text-right">Doors</th>
            <th className="border border-gray-200 px-3 py-2 text-right">Drawers</th>
            <th className="border border-gray-200 px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {payload.cabinets.map((cabinet, index) => (
            <tr key={`${cabinet.cabinetType}-${index}`}>
              <td className="border border-gray-200 px-3 py-2">{cabinet.cabinetType.replace("_", " ")}</td>
              <td className="border border-gray-200 px-3 py-2">{cabinet.configuration.replaceAll("_", " ")}</td>
              <td className="border border-gray-200 px-3 py-2 text-right">
                {cabinet.doors.reduce((sum, d) => sum + d.quantity, 0)}
              </td>
              <td className="border border-gray-200 px-3 py-2 text-right">
                {cabinet.drawers.reduce((sum, d) => sum + d.quantity, 0)}
              </td>
              <td className="border border-gray-200 px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => removeCabinet(index)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-gray-600">
          <span>Multiplier</span>
          <input
            type="number"
            min={1}
            max={10}
            step={0.01}
            value={payload.multiplier}
            onChange={(e) =>
              setPayload({ ...payload, multiplier: Number(e.target.value) || DEFAULT_KITCHEN_MARKUP })
            }
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-600">
          <span>Discount % (0-10)</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={payload.discountPercent}
            onChange={(e) =>
              setPayload({ ...payload, discountPercent: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })
            }
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-600">
          <span>Delivery cost</span>
          <input
            type="number"
            min={0}
            value={payload.deliveryCost ?? 500}
            onChange={(e) => setPayload({ ...payload, deliveryCost: Number(e.target.value) || 0 })}
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-4 pb-1 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={payload.includeInstallation}
              onChange={(e) => setPayload({ ...payload, includeInstallation: e.target.checked })}
            />
            Installation
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={payload.includeDelivery}
              onChange={(e) => setPayload({ ...payload, includeDelivery: e.target.checked })}
            />
            Delivery
          </label>
        </div>
      </div>

      {payload.includeInstallation && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-gray-600">
            <span>Base install qty</span>
            <input
              type="number"
              min={0}
              value={payload.installation.baseCabinetQty}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  installation: { ...payload.installation, baseCabinetQty: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            <span>Wall install qty</span>
            <input
              type="number"
              min={0}
              value={payload.installation.wallCabinetQty}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  installation: { ...payload.installation, wallCabinetQty: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            <span>Pantry install qty</span>
            <input
              type="number"
              min={0}
              value={payload.installation.pantryQty}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  installation: { ...payload.installation, pantryQty: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            <span>Finishing panels qty</span>
            <input
              type="number"
              min={0}
              value={payload.installation.finishingPanelQty}
              onChange={(e) =>
                setPayload({
                  ...payload,
                  installation: { ...payload.installation, finishingPanelQty: Number(e.target.value) || 0 },
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
        </div>
      )}

      <div className="rounded bg-gray-50 p-4 space-y-2">
        <h3 className="font-medium text-gray-800">Kitchen pricing summary</h3>
        {canSeeBreakdown && data.totals ? (
          <>
            <p className="text-sm text-gray-700">Materials: <strong>{formatCurrency(data.totals.materialsSubtotal)}</strong></p>
            <p className="text-sm text-gray-700">Fabrication: <strong>{formatCurrency(data.totals.fabricationSubtotal)}</strong></p>
            <p className="text-sm text-gray-700">Installation: <strong>{formatCurrency(data.totals.installationSubtotal)}</strong></p>
            <p className="text-sm text-gray-700">Delivery: <strong>{formatCurrency(data.totals.deliverySubtotal)}</strong></p>
            <p className="text-sm text-gray-700">Total cost: <strong>{formatCurrency(data.totals.totalCost)}</strong></p>
            <p className="text-sm text-gray-700">Sales (x{data.sales.multiplier}): <strong>{formatCurrency(data.sales.salesPriceRaw)}</strong></p>
          </>
        ) : (
          <p className="text-sm text-gray-700">Final sales price only (cost breakdown hidden by role policy).</p>
        )}
        <p className="text-lg font-semibold text-gray-900">
          Final sales price: {formatCurrency(data.sales.finalSalesPrice)}
        </p>
        <p className="text-xs text-gray-500">
          Approval status: <strong>{data.approval?.status ?? "not_required"}</strong>
          {data.approval?.reason ? ` (${data.approval.reason})` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveBuilder}
          disabled={saving}
          className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save builder"}
        </button>
        <button
          type="button"
          onClick={submitBuilder}
          disabled={submitting || saving}
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit quote"}
        </button>
        {isKitchenManagerRole(role) && data.approval?.status === "pending" && (
          <>
            <button
              type="button"
              onClick={() => approve("approved")}
              disabled={approvalBusy}
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => approve("rejected")}
              disabled={approvalBusy}
              className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>

      {/* Sticky live price bar (mobile-first). */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-gray-500">Final sales price</div>
            <div className="text-base font-semibold text-gray-900 truncate">
              {formatCurrency(data.sales.finalSalesPrice)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={saveBuilder}
              disabled={saving}
              className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={submitBuilder}
              disabled={submitting || saving}
              className="neo-btn px-4 py-2 text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KitchenTab(props: KitchenTabProps) {
  return (
    <StandardsProvider projectId={props.projectId}>
      <KitchenTabInner {...props} />
    </StandardsProvider>
  );
}
