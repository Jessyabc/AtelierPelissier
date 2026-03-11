"use client";

import { useState } from "react";
import type { SupplierShortageGroup, ShortageItem } from "@/app/home/page";
import { buildEmailDraft } from "@/lib/purchasing/buildEmailDraft";

export function PurchaseFlowModal({
  group,
  onClose,
  onComplete,
}: {
  group: SupplierShortageGroup;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [orderType, setOrderType] = useState<"order" | "reserve">("order");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of group.items) {
      init[item.materialCode] = item.shortageQty;
    }
    return init;
  });
  const [deliveryDate, setDeliveryDate] = useState("");
  const [projectRef, setProjectRef] = useState(() => {
    // Auto-detect project ref from shortage items
    const allProjects = group.items.flatMap((i) => i.projects);
    if (allProjects.length === 1) return allProjects[0].jobNumber ?? allProjects[0].name;
    return "";
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleQtyChange(code: string, val: number) {
    setQuantities((prev) => ({ ...prev, [code]: Math.max(0, val) }));
  }

  async function handleCreateDraftAndEmail() {
    setSaving(true);
    try {
      // Create draft order in DB
      const res = await fetch("/api/ops/purchase-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: group.supplierId,
          orderType,
          expectedDeliveryDate: deliveryDate || null,
          items: group.items
            .filter((item) => (quantities[item.materialCode] ?? 0) > 0)
            .map((item) => ({
              inventoryItemId: item.inventoryItemId,
              materialCode: item.materialCode,
              quantity: quantities[item.materialCode] ?? item.shortageQty,
              unitCost: 0,
            })),
        }),
      });

      if (!res.ok) throw new Error("Failed to create draft");

      // Build and open mailto
      const emailItems = group.items
        .filter((item) => (quantities[item.materialCode] ?? 0) > 0)
        .map((item) => ({
          materialCode: item.materialCode,
          description: item.description,
          quantity: quantities[item.materialCode] ?? item.shortageQty,
          unitCost: 0,
          supplierSku: "",
        }));

      const { mailto } = buildEmailDraft({
        supplierEmail: group.supplierEmail,
        supplierName: group.supplierName,
        orderType,
        projectRef: projectRef || null,
        items: emailItems,
        requestedDeliveryDate: deliveryDate || null,
        notes: notes || undefined,
      });

      window.open(mailto, "_blank");
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to create draft order");
    } finally {
      setSaving(false);
    }
  }

  const totalItems = group.items.filter(
    (item) => (quantities[item.materialCode] ?? 0) > 0
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="neo-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {saved ? "Draft Created" : `Order from ${group.supplierName}`}
          </h2>
          <button onClick={onClose} className="neo-icon-btn w-8 h-8 text-sm">
            x
          </button>
        </div>

        {saved ? (
          <div className="text-center space-y-4">
            <p className="text-[var(--foreground-muted)]">
              Draft order created and email compose opened. Mark the order as
              &quot;placed&quot; once you&apos;ve sent the email.
            </p>
            <button
              onClick={onComplete}
              className="neo-btn-primary px-6 py-2.5 text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Order Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Type
              </label>
              <div className="neo-segment">
                <button
                  onClick={() => setOrderType("order")}
                  className={orderType === "order" ? "neo-btn-primary px-4 py-1.5 text-sm" : "neo-segment-btn"}
                >
                  Order
                </button>
                <button
                  onClick={() => setOrderType("reserve")}
                  className={orderType === "reserve" ? "neo-btn-primary px-4 py-1.5 text-sm" : "neo-segment-btn"}
                >
                  Reserve
                </button>
              </div>
            </div>

            {/* Reference & Delivery Date */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Project Reference
                </label>
                <input
                  value={projectRef}
                  onChange={(e) => setProjectRef(e.target.value)}
                  placeholder="Job# or client name"
                  className="neo-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Requested Delivery
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="neo-input w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Material Lines */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Materials ({totalItems} item{totalItems !== 1 ? "s" : ""})
              </label>
              <div className="neo-panel-inset p-3 space-y-2">
                {group.items.map((item) => (
                  <MaterialLine
                    key={item.materialCode}
                    item={item}
                    quantity={quantities[item.materialCode] ?? 0}
                    onQtyChange={(v) => handleQtyChange(item.materialCode, v)}
                  />
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="neo-input w-full px-3 py-2 text-sm resize-none"
                placeholder="Any special instructions..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="neo-btn px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreateDraftAndEmail}
                disabled={saving || totalItems === 0}
                className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Draft & Open Email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialLine({
  item,
  quantity,
  onQtyChange,
}: {
  item: ShortageItem;
  quantity: number;
  onQtyChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--foreground)] truncate">
          {item.materialCode}
        </div>
        <div className="text-xs text-[var(--foreground-muted)] truncate">
          {item.description} — short {item.shortageQty}, avail {item.availableQty}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[var(--foreground-muted)]">Qty:</label>
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => onQtyChange(parseInt(e.target.value) || 0)}
          className="neo-input w-20 px-2 py-1.5 text-sm text-center"
        />
      </div>
    </div>
  );
}
