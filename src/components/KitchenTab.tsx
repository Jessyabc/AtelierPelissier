"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  };

  const removeCabinet = (index: number) => {
    if (!payload) return;
    setPayload({
      ...payload,
      cabinets: payload.cabinets.filter((_, i) => i !== index),
    });
  };

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
    <div className="space-y-6">
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
        <h3 className="text-sm font-semibold text-gray-800">Step 2 — Add cabinets</h3>
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
