"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ReceiveOrderModal } from "@/components/ops/ReceiveOrderModal";

// --- Types ---
type Supplier = {
  id: string;
  name: string;
  email: string | null;
  contactInfo: string | null;
  notes: string | null;
};

type CatalogItem = {
  id: string;
  supplierId: string;
  supplierSku: string;
  inventoryItemId: string;
  unitCost: number;
  leadTimeDays: number | null;
  isDefault: boolean;
  inventoryItem?: { materialCode: string; description: string };
};

type OrderLine = {
  id: string;
  materialCode: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  inventoryItem?: { description: string } | null;
};

type Order = {
  id: string;
  supplier: string;
  supplierId: string | null;
  status: string;
  orderType: string;
  expectedDeliveryDate: string | null;
  projectId: string | null;
  placedAt: string | null;
  backorderExpectedDate: string | null;
  backorderNotes: string | null;
  lines: OrderLine[];
  project?: { name: string; jobNumber: string | null } | null;
};

type InventoryItem = { id: string; materialCode: string; description: string };

type Tab = "suppliers" | "catalog" | "orders";

const EMPTY_SUPPLIER = { name: "", email: "", contactInfo: "", notes: "" };

export default function SuppliersAndPurchasingPage() {
  const [tab, setTab] = useState<Tab>("suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Supplier form
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Catalog form
  const [catalogForm, setCatalogForm] = useState({ supplierId: "", supplierSku: "", inventoryItemId: "", unitCost: "", leadTimeDays: "", isDefault: false });

  // Order form
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({ supplierId: "", supplierName: "", orderType: "order" as "order" | "reserve", status: "draft" as const });

  // Receiving modal
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null);

  // Edit order
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editOrderForm, setEditOrderForm] = useState({ expectedDeliveryDate: "", backorderExpectedDate: "", backorderNotes: "", status: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, catRes, ordRes, invRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/supplier-catalog"),
        fetch("/api/orders"),
        fetch("/api/inventory-items"),
      ]);
      setSuppliers(await supRes.json().catch(() => []));
      setCatalog(await catRes.json().catch(() => []));
      setOrders(await ordRes.json().catch(() => []));
      setInventoryItems(await invRes.json().catch(() => []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Supplier CRUD ---
  async function saveSupplier() {
    const name = supplierForm.name.trim();
    if (!name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const body = { name, email: supplierForm.email.trim() || null, contactInfo: supplierForm.contactInfo.trim() || null, notes: supplierForm.notes.trim() || null };
      if (editingSupplierId) {
        await fetch(`/api/suppliers/${editingSupplierId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        toast.success("Supplier updated");
      } else {
        await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        toast.success("Supplier added");
      }
      setSupplierForm(EMPTY_SUPPLIER);
      setEditingSupplierId(null);
      await fetchAll();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Delete this supplier and all catalog items?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (editingSupplierId === id) { setEditingSupplierId(null); setSupplierForm(EMPTY_SUPPLIER); }
    await fetchAll();
    toast.success("Deleted");
  }

  // --- Catalog CRUD ---
  async function saveCatalogItem() {
    if (!catalogForm.supplierId || !catalogForm.inventoryItemId || !catalogForm.supplierSku.trim()) {
      toast.error("Supplier, material, and SKU required");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/supplier-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: catalogForm.supplierId,
          supplierSku: catalogForm.supplierSku.trim(),
          inventoryItemId: catalogForm.inventoryItemId,
          unitCost: parseFloat(catalogForm.unitCost) || 0,
          leadTimeDays: catalogForm.leadTimeDays ? parseInt(catalogForm.leadTimeDays) : null,
          isDefault: catalogForm.isDefault,
        }),
      });
      setCatalogForm({ supplierId: "", supplierSku: "", inventoryItemId: "", unitCost: "", leadTimeDays: "", isDefault: false });
      await fetchAll();
      toast.success("Catalog item added");
    } catch { toast.error("Failed to add"); } finally { setSaving(false); }
  }

  async function deleteCatalogItem(id: string) {
    await fetch(`/api/supplier-catalog/${id}`, { method: "DELETE" });
    await fetchAll();
    toast.success("Removed");
  }

  async function toggleDefault(item: CatalogItem) {
    await fetch(`/api/supplier-catalog/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: !item.isDefault }),
    });
    await fetchAll();
  }

  // --- Order CRUD ---
  async function createOrder() {
    const name = orderForm.supplierId ? suppliers.find((s) => s.id === orderForm.supplierId)?.name ?? orderForm.supplierName : orderForm.supplierName.trim();
    if (!name) { toast.error("Supplier required"); return; }
    setSaving(true);
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier: name, supplierId: orderForm.supplierId || null, status: orderForm.status, orderType: orderForm.orderType }),
      });
      setShowNewOrder(false);
      setOrderForm({ supplierId: "", supplierName: "", orderType: "order", status: "draft" });
      await fetchAll();
      toast.success("Order created");
    } catch { toast.error("Failed to create"); } finally { setSaving(false); }
  }

  async function updateOrder() {
    if (!editingOrderId) return;
    try {
      const body: Record<string, unknown> = {};
      if (editOrderForm.status) body.status = editOrderForm.status;
      body.expectedDeliveryDate = editOrderForm.expectedDeliveryDate ? new Date(editOrderForm.expectedDeliveryDate).toISOString() : null;
      body.backorderExpectedDate = editOrderForm.backorderExpectedDate ? new Date(editOrderForm.backorderExpectedDate).toISOString() : null;
      body.backorderNotes = editOrderForm.backorderNotes.trim() || null;
      await fetch(`/api/orders/${editingOrderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setEditingOrderId(null);
      await fetchAll();
      toast.success("Updated");
    } catch { toast.error("Failed"); }
  }

  const openOrders = orders.filter((o) => ["draft", "placed", "partial"].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === "received" || o.status === "cancelled");
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "?";

  if (loading) {
    return <div className="max-w-5xl mx-auto py-8 text-center text-[var(--foreground-muted)]">Loading suppliers & purchasing...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Suppliers & Purchasing</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-0.5">Contacts, catalog, orders, and receiving — all in one place.</p>
        </div>
        <button onClick={fetchAll} className="neo-btn px-3 py-1.5 text-xs">Refresh</button>
      </div>

      {/* Tab Bar */}
      <div className="neo-segment">
        {(["suppliers", "catalog", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "neo-btn-primary px-4 py-1.5 text-sm" : "neo-segment-btn"}
          >
            {t === "suppliers" ? `Suppliers (${suppliers.length})` : t === "catalog" ? `Catalog (${catalog.length})` : `Orders (${openOrders.length})`}
          </button>
        ))}
      </div>

      {/* === SUPPLIERS TAB === */}
      {tab === "suppliers" && (
        <div className="space-y-4">
          <div className="neo-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              {editingSupplierId ? "Edit Supplier" : "Add Supplier"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Name *</label>
                <input value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="e.g. Richelieu" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Email</label>
                <input value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="orders@supplier.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Contact Info</label>
                <input value={supplierForm.contactInfo} onChange={(e) => setSupplierForm((f) => ({ ...f, contactInfo: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="Phone, rep name..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Notes</label>
                <input value={supplierForm.notes} onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="Account#, terms..." />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={saveSupplier} disabled={saving} className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50">
                {saving ? "Saving..." : editingSupplierId ? "Update" : "Add Supplier"}
              </button>
              {editingSupplierId && (
                <button onClick={() => { setEditingSupplierId(null); setSupplierForm(EMPTY_SUPPLIER); }} className="neo-btn px-3 py-2 text-sm">Cancel</button>
              )}
            </div>
          </div>

          {suppliers.length === 0 ? (
            <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">No suppliers yet. Add one above.</div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s) => (
                <div key={s.id} className="neo-card p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-[var(--foreground)]">{s.name}</div>
                    <div className="text-xs text-[var(--foreground-muted)] space-x-3">
                      {s.email && <span>{s.email}</span>}
                      {s.contactInfo && <span>{s.contactInfo}</span>}
                      {s.notes && <span>{s.notes}</span>}
                    </div>
                    <div className="text-xs text-[var(--foreground-muted)] mt-1">
                      {catalog.filter((c) => c.supplierId === s.id).length} catalog items
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingSupplierId(s.id); setSupplierForm({ name: s.name, email: s.email ?? "", contactInfo: s.contactInfo ?? "", notes: s.notes ?? "" }); }} className="neo-btn px-2 py-1 text-xs">Edit</button>
                    <button onClick={() => deleteSupplier(s.id)} className="neo-btn px-2 py-1 text-xs text-red-500">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === CATALOG TAB === */}
      {tab === "catalog" && (
        <div className="space-y-4">
          <div className="neo-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Link Material to Supplier</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Supplier *</label>
                <select value={catalogForm.supplierId} onChange={(e) => setCatalogForm((f) => ({ ...f, supplierId: e.target.value }))} className="neo-select w-full px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Material *</label>
                <select value={catalogForm.inventoryItemId} onChange={(e) => setCatalogForm((f) => ({ ...f, inventoryItemId: e.target.value }))} className="neo-select w-full px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {inventoryItems.map((i) => <option key={i.id} value={i.id}>{i.materialCode} — {i.description}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Supplier SKU *</label>
                <input value={catalogForm.supplierSku} onChange={(e) => setCatalogForm((f) => ({ ...f, supplierSku: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="Supplier part#" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Unit Cost ($)</label>
                <input type="number" min="0" step="0.01" value={catalogForm.unitCost} onChange={(e) => setCatalogForm((f) => ({ ...f, unitCost: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Lead Time (days)</label>
                <input type="number" min="0" value={catalogForm.leadTimeDays} onChange={(e) => setCatalogForm((f) => ({ ...f, leadTimeDays: e.target.value }))} className="neo-input w-full px-3 py-2 text-sm" placeholder="e.g. 7" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" checked={catalogForm.isDefault} onChange={(e) => setCatalogForm((f) => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                  Default supplier for this material
                </label>
              </div>
            </div>
            <button onClick={saveCatalogItem} disabled={saving} className="neo-btn-primary px-4 py-2 text-sm mt-3 disabled:opacity-50">
              {saving ? "Saving..." : "Add to Catalog"}
            </button>
          </div>

          {catalog.length === 0 ? (
            <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">No catalog items. Link materials to suppliers above.</div>
          ) : (
            <div className="neo-panel-inset p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--foreground-muted)]">
                    <th className="pb-2 pr-3">Supplier</th>
                    <th className="pb-2 pr-3">Material</th>
                    <th className="pb-2 pr-3">SKU</th>
                    <th className="pb-2 pr-3 text-right">Cost</th>
                    <th className="pb-2 pr-3 text-right">Lead</th>
                    <th className="pb-2 pr-3 text-center">Default</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--shadow-dark)]/20">
                      <td className="py-2 pr-3 text-[var(--foreground)]">{supplierName(item.supplierId)}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-[var(--foreground)]">{item.inventoryItem?.materialCode}</div>
                        <div className="text-xs text-[var(--foreground-muted)]">{item.inventoryItem?.description}</div>
                      </td>
                      <td className="py-2 pr-3 text-[var(--foreground-muted)]">{item.supplierSku}</td>
                      <td className="py-2 pr-3 text-right">${item.unitCost.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{item.leadTimeDays ?? "—"} d</td>
                      <td className="py-2 pr-3 text-center">
                        <button onClick={() => toggleDefault(item)} className={`w-5 h-5 rounded-full ${item.isDefault ? "bg-[var(--accent)]" : "bg-[var(--shadow-dark)]"}`} />
                      </td>
                      <td className="py-2">
                        <button onClick={() => deleteCatalogItem(item.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === ORDERS TAB === */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewOrder(true)} className="neo-btn-primary px-4 py-2 text-sm font-medium">New Order</button>
          </div>

          {showNewOrder && (
            <div className="neo-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">New Order</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={orderForm.supplierId} onChange={(e) => setOrderForm((f) => ({ ...f, supplierId: e.target.value }))} className="neo-select px-3 py-2 text-sm">
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input value={orderForm.supplierName} onChange={(e) => setOrderForm((f) => ({ ...f, supplierName: e.target.value }))} placeholder="Or type name" className="neo-input px-3 py-2 text-sm" />
                <div className="neo-segment">
                  <button onClick={() => setOrderForm((f) => ({ ...f, orderType: "order" }))} className={orderForm.orderType === "order" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>Order</button>
                  <button onClick={() => setOrderForm((f) => ({ ...f, orderType: "reserve" }))} className={orderForm.orderType === "reserve" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>Reserve</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createOrder} disabled={saving} className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50">{saving ? "Creating..." : "Create"}</button>
                <button onClick={() => setShowNewOrder(false)} className="neo-btn px-3 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {openOrders.length === 0 ? (
            <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">No open orders.</div>
          ) : (
            <div className="space-y-3">
              {openOrders.map((order) => {
                const isLate = order.status === "placed" && order.expectedDeliveryDate && new Date(order.expectedDeliveryDate) < new Date();
                return (
                  <div key={order.id} className={`neo-card p-4 ${isLate ? "severity-high" : ""} ${order.backorderNotes ? "severity-medium" : ""}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[var(--foreground)]">{order.supplier}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-light)] text-[var(--foreground-muted)]">{order.status}</span>
                        {order.orderType === "reserve" && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">reserve</span>}
                        {isLate && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">LATE</span>}
                        {order.backorderNotes && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">backordered</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingOrderId(order.id); setEditOrderForm({ expectedDeliveryDate: order.expectedDeliveryDate?.slice(0, 10) ?? "", backorderExpectedDate: order.backorderExpectedDate?.slice(0, 10) ?? "", backorderNotes: order.backorderNotes ?? "", status: order.status }); }} className="neo-btn px-2 py-1 text-xs">Edit</button>
                        {(order.status === "placed" || order.status === "partial") && (
                          <button onClick={() => setReceiveOrderId(order.id)} className="neo-btn-primary px-3 py-1 text-xs">Receive</button>
                        )}
                      </div>
                    </div>

                    {editingOrderId === order.id && (
                      <div className="mt-3 neo-panel-inset p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label className="block text-xs text-[var(--foreground-muted)]">Status</label>
                            <select value={editOrderForm.status} onChange={(e) => setEditOrderForm((f) => ({ ...f, status: e.target.value }))} className="neo-select w-full px-2 py-1.5 text-sm">
                              <option value="draft">Draft</option>
                              <option value="placed">Placed</option>
                              <option value="partial">Partial</option>
                              <option value="received">Received</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--foreground-muted)]">Expected Delivery</label>
                            <input type="date" value={editOrderForm.expectedDeliveryDate} onChange={(e) => setEditOrderForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))} className="neo-input w-full px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--foreground-muted)]">Backorder Date</label>
                            <input type="date" value={editOrderForm.backorderExpectedDate} onChange={(e) => setEditOrderForm((f) => ({ ...f, backorderExpectedDate: e.target.value }))} className="neo-input w-full px-2 py-1.5 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--foreground-muted)]">Backorder Notes</label>
                          <input value={editOrderForm.backorderNotes} onChange={(e) => setEditOrderForm((f) => ({ ...f, backorderNotes: e.target.value }))} className="neo-input w-full px-2 py-1.5 text-sm" placeholder="e.g. 4+ weeks" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={updateOrder} className="neo-btn-primary px-3 py-1.5 text-xs">Save</button>
                          <button onClick={() => setEditingOrderId(null)} className="neo-btn px-3 py-1.5 text-xs">Cancel</button>
                        </div>
                      </div>
                    )}

                    {order.lines.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {order.lines.map((l) => {
                          const done = l.receivedQty >= l.quantity;
                          return (
                            <span key={l.id} className={`text-xs px-2 py-0.5 rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-[var(--bg-light)] text-[var(--foreground-muted)]"}`}>
                              {l.inventoryItem?.description ?? l.materialCode}: {l.receivedQty}/{l.quantity}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-3 mt-2 text-xs text-[var(--foreground-muted)]">
                      {order.placedAt && <span>Placed: {new Date(order.placedAt).toLocaleDateString("en-CA")}</span>}
                      {order.expectedDeliveryDate && <span>Expected: {new Date(order.expectedDeliveryDate).toLocaleDateString("en-CA")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completedOrders.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-[var(--foreground-muted)] cursor-pointer">{completedOrders.length} completed/cancelled orders</summary>
              <div className="space-y-2 mt-2">
                {completedOrders.map((o) => (
                  <div key={o.id} className="neo-card p-3 opacity-60">
                    <span className="text-sm text-[var(--foreground)]">{o.supplier}</span>
                    <span className="ml-2 text-xs text-[var(--foreground-muted)]">{o.status} — {o.lines.length} lines</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Receive Modal */}
      {receiveOrderId && (
        <ReceiveOrderModal
          orderId={receiveOrderId}
          onClose={() => setReceiveOrderId(null)}
          onComplete={() => { setReceiveOrderId(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
