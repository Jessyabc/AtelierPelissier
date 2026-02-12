"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type VendorInvoiceLine = {
  id: string;
  descriptionRaw: string;
  qty: number;
  unitCost: number;
  mappedProjectId: string | null;
  mappedCategory: string;
};

type VendorInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: { id: string; name: string };
  lines: VendorInvoiceLine[];
};

export default function CostingPage() {
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
  });
  const [creating, setCreating] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, supRes] = await Promise.all([
        fetch("/api/vendor-invoices"),
        fetch("/api/suppliers"),
      ]);
      const invData = await invRes.json();
      const supData = await supRes.json();
      setInvoices(Array.isArray(invData) ? invData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
    } catch {
      setInvoices([]);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvoice = async () => {
    if (!newInvoiceForm.supplierId || !newInvoiceForm.invoiceNumber.trim()) {
      toast.error("Supplier and invoice number required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/vendor-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: newInvoiceForm.supplierId,
          invoiceNumber: newInvoiceForm.invoiceNumber.trim(),
          invoiceDate: newInvoiceForm.invoiceDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Invoice created");
      setShowNewInvoice(false);
      setNewInvoiceForm({ supplierId: "", invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10) });
      await fetchInvoices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Costing & Invoices</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchInvoices}
            disabled={loading}
            className="neo-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowNewInvoice(true)}
            className="neo-btn-primary inline-block px-4 py-2 text-sm font-medium"
          >
            New invoice
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Vendor invoices and line mapping. Map lines to projects and categories for estimate vs actual comparison.
        <Link href="/dashboard" className="ml-1 text-[var(--accent-hover)] hover:underline">
          View project drilldown
        </Link>
      </p>

      {loading ? (
        <p className="py-8 text-center text-gray-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="neo-card p-8 text-center text-sm text-gray-500">
          No vendor invoices yet. Create one to start mapping costs.
        </p>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-medium text-gray-800">Invoices</h2>
          <div className="space-y-4">
            {invoices.map((inv) => (
              <div key={inv.id} className="neo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{inv.invoiceNumber}</span>
                    <span className="ml-2 text-sm text-gray-600">{inv.supplier?.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      {new Date(inv.invoiceDate).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{inv.lines?.length ?? 0} lines</span>
                </div>
                {inv.lines?.length > 0 && (
                  <div className="mt-3 text-sm text-gray-600">
                    {inv.lines.length} line(s) —{" "}
                    {inv.lines
                      .filter((l) => l.mappedProjectId)
                      .length}{" "}
                    mapped to projects
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showNewInvoice && (
        <div className="neo-card p-4 mt-4">
          <h3 className="mb-3 text-sm font-semibold">New vendor invoice</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={newInvoiceForm.supplierId}
              onChange={(e) => setNewInvoiceForm((f) => ({ ...f, supplierId: e.target.value }))}
              className="neo-input px-3 py-2 text-sm"
            >
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Invoice number *"
              value={newInvoiceForm.invoiceNumber}
              onChange={(e) => setNewInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              className="neo-input px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={newInvoiceForm.invoiceDate}
              onChange={(e) => setNewInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              className="neo-input px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={createInvoice}
              disabled={creating || !newInvoiceForm.supplierId || !newInvoiceForm.invoiceNumber.trim()}
              className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowNewInvoice(false)} className="neo-btn px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
