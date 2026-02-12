"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type OrderLine = {
  id: string;
  materialCode: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  projectId: string | null;
};

type Order = {
  id: string;
  supplier: string;
  supplierId: string | null;
  status: string;
  expectedDeliveryDate: string | null;
  projectId: string | null;
  createdAt: string;
  lines: OrderLine[];
};

export default function PurchasingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivingLine, setReceivingLine] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({ supplierId: "", supplier: "", status: "draft" as const });
  const [creating, setCreating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, suppliersRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/suppliers"),
      ]);
      const ordersData = await ordersRes.json();
      const suppliersData = await suppliersRes.json();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch {
      setOrders([]);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = async () => {
    const supplierName = newOrderForm.supplierId
      ? suppliers.find((s) => s.id === newOrderForm.supplierId)?.name ?? newOrderForm.supplier
      : newOrderForm.supplier.trim();
    if (!supplierName) {
      toast.error("Supplier name or selection required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: supplierName,
          supplierId: newOrderForm.supplierId || null,
          status: newOrderForm.status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Order created");
      setShowNewOrder(false);
      setNewOrderForm({ supplierId: "", supplier: "", status: "draft" });
      await fetchOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openOrders = orders.filter((o) => ["draft", "placed", "partial"].includes(o.status));
  const lateOrders = openOrders.filter((o) => {
    if (!o.expectedDeliveryDate) return false;
    return new Date(o.expectedDeliveryDate) < new Date();
  });

  const handleReceive = async (orderId: string, line: OrderLine, qty: number) => {
    setReceivingLine(line.id);
    try {
      const res = await fetch(`/api/orders/${orderId}/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedQty: qty }),
      });
      if (!res.ok) throw new Error("Receive failed");
      toast.success(`Received ${qty} of ${line.materialCode}`);
      await fetchOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to receive");
    } finally {
      setReceivingLine(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Purchasing</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="neo-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowNewOrder(true)}
            className="neo-btn-primary inline-block px-4 py-2 text-sm font-medium"
          >
            New order
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-gray-500">Loading…</p>
      ) : (
        <>
          {lateOrders.length > 0 && (
            <section className="neo-card p-4 severity-medium">
              <h2 className="mb-2 text-sm font-semibold text-amber-800">Late / overdue</h2>
              <ul className="text-sm text-amber-700">
                {lateOrders.map((o) => (
                  <li key={o.id}>
                    {o.supplier} — expected {o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : "?"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-medium text-gray-800">Open orders</h2>
            {openOrders.length === 0 ? (
              <p className="neo-card p-6 text-sm text-gray-500">No open orders.</p>
            ) : (
              <div className="space-y-4">
                {openOrders.map((order) => (
                  <div key={order.id} className="neo-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-gray-900">{order.supplier}</span>
                        <span className="ml-2 rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                          {order.status}
                        </span>
                        {order.expectedDeliveryDate && (
                          <span className="ml-2 text-sm text-gray-500">
                            Expected {new Date(order.expectedDeliveryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">Order #{order.id.slice(-6)}</span>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-600">
                            <th className="pb-2 pr-4">Material</th>
                            <th className="pb-2 pr-4 text-right">Ordered</th>
                            <th className="pb-2 pr-4 text-right">Received</th>
                            <th className="pb-2 pr-4 text-right">Receive</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.lines.map((line) => (
                            <tr key={line.id} className="border-b border-gray-100">
                              <td className="py-2 pr-4">{line.materialCode}</td>
                              <td className="py-2 pr-4 text-right">{line.quantity}</td>
                              <td className="py-2 pr-4 text-right">{line.receivedQty}</td>
                              <td className="py-2">
                                {line.receivedQty < line.quantity ? (
                                  <button
                                    type="button"
                                    disabled={receivingLine !== null}
                                    onClick={() =>
                                      handleReceive(order.id, line, line.quantity)
                                    }
                                    className="neo-btn px-2 py-1 text-xs disabled:opacity-50"
                                  >
                                    {receivingLine === line.id ? "…" : "Receive all"}
                                  </button>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showNewOrder && (
            <div className="neo-card p-4 mt-4">
              <h3 className="mb-3 text-sm font-semibold">New order</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={newOrderForm.supplierId}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, supplierId: e.target.value }))}
                  className="neo-input px-3 py-2 text-sm"
                >
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or type supplier name"
                  value={newOrderForm.supplier}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, supplier: e.target.value }))}
                  className="neo-input px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={createOrder}
                  disabled={creating || (!newOrderForm.supplierId && !newOrderForm.supplier.trim())}
                  className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowNewOrder(false)} className="neo-btn px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
