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

type CostDocument = {
  id: string;
  type: string;
  sourceName: string;
  storagePath: string;
  invoiceNumber: string | null;
  createdAt: string;
  projectId: string | null;
  project?: { id: string; name: string; jobNumber: string | null } | null;
};

type ProjectOption = { id: string; name: string; jobNumber: string | null };

const DOC_TYPES = [
  { value: "reservation", label: "Reservation invoice" },
  { value: "supplier_invoice", label: "Supplier invoice" },
  { value: "estimate", label: "Estimate (Excel)" },
  { value: "sage_invoice", label: "Sage invoice" },
  { value: "other", label: "Other" },
] as const;

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

  const [costDocs, setCostDocs] = useState<CostDocument[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>("supplier_invoice");
  const [uploadProjectId, setUploadProjectId] = useState<string>("misc");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);

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

  const fetchCostDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const [docsRes, projRes] = await Promise.all([
        fetch("/api/cost-documents"),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : [])),
      ]);
      const docsData = await docsRes.json();
      setCostDocs(Array.isArray(docsData) ? docsData : []);
      setProjects(Array.isArray(projRes) ? projRes : []);
    } catch {
      setCostDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchCostDocs();
  }, [fetchCostDocs]);

  const handleDocUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.size === 0) return;
      setUploadingDoc(true);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("type", uploadDocType);
        form.set("projectId", uploadProjectId === "misc" ? "misc" : uploadProjectId);
        const res = await fetch("/api/cost-documents", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Upload failed");
        toast.success("Document uploaded");
        setUploadInputKey((k) => k + 1);
        await fetchCostDocs();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadingDoc(false);
        e.target.value = "";
      }
    },
    [uploadDocType, uploadProjectId, fetchCostDocs]
  );

  const byProject = costDocs.reduce(
    (acc, d) => {
      const key = d.projectId ?? "__misc__";
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    },
    {} as Record<string, CostDocument[]>
  );
  const miscDocs = byProject["__misc__"] ?? [];
  const projectKeys = Object.keys(byProject).filter((k) => k !== "__misc__");

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
        Upload reservations, supplier invoices, estimates, and Sage invoices. Assign to a project or keep in Miscellaneous.
        Vendor invoices and line mapping below for estimate vs actual.
        <Link href="/dashboard" className="ml-1 text-[var(--accent-hover)] hover:underline">
          View project drilldown
        </Link>
      </p>

      {/* Document upload */}
      <section className="neo-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Upload document</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={uploadDocType}
              onChange={(e) => setUploadDocType(e.target.value)}
              className="neo-select px-3 py-2 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assign to</label>
            <select
              value={uploadProjectId}
              onChange={(e) => setUploadProjectId(e.target.value)}
              className="neo-select px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="misc">Miscellaneous</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber ? `${p.jobNumber} — ` : ""}{p.name}
                </option>
              ))}
            </select>
          </div>
          <label className="cursor-pointer neo-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50">
            {uploadingDoc ? "Uploading…" : "Choose file"}
            <input
              key={uploadInputKey}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.txt"
              className="hidden"
              onChange={handleDocUpload}
              disabled={uploadingDoc}
            />
          </label>
        </div>
      </section>

      {/* Document history: per project + miscellaneous */}
      <section className="neo-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Document history</h2>
        {loadingDocs ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : costDocs.length === 0 ? (
          <p className="text-sm text-gray-500">No documents yet. Upload above to get started.</p>
        ) : (
          <div className="space-y-4">
            {projectKeys.map((pid) => {
              const list = byProject[pid];
              const proj = list?.[0]?.project;
              return (
                <div key={pid}>
                  <h3 className="text-xs font-medium text-gray-600 mb-2">
                    {proj?.jobNumber ? `${proj.jobNumber} — ` : ""}{proj?.name ?? pid}
                    <Link href={`/projects/${pid}`} className="ml-2 text-[var(--accent)] hover:underline">Open</Link>
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {list?.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">
                        <span className="capitalize text-gray-700">{d.type.replace(/_/g, " ")}</span>
                        <a href={`/${d.storagePath}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-[200px]">
                          {d.sourceName}
                        </a>
                        {d.invoiceNumber && <span className="text-gray-500">{d.invoiceNumber}</span>}
                        <span className="text-gray-400">{new Date(d.createdAt).toLocaleDateString("en-CA")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {miscDocs.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-600 mb-2">Miscellaneous</h3>
                <ul className="space-y-1 text-sm">
                  {miscDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <span className="capitalize text-gray-700">{d.type.replace(/_/g, " ")}</span>
                      <a href={`/${d.storagePath}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate max-w-[200px]">
                        {d.sourceName}
                      </a>
                      {d.invoiceNumber && <span className="text-gray-500">{d.invoiceNumber}</span>}
                      <span className="text-gray-400">{new Date(d.createdAt).toLocaleDateString("en-CA")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

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
