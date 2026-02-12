"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Distributor = {
  id: string;
  referenceName: string;
  companyName: string;
  phoneNumber: string | null;
  extension: string | null;
  accountNumber: string | null;
  notes: string | null;
};

const EMPTY = {
  referenceName: "",
  companyName: "",
  phoneNumber: "",
  extension: "",
  accountNumber: "",
  notes: "",
};

export default function DistributorsPage() {
  const [list, setList] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/distributors");
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const addDistributor = useCallback(async () => {
    const ref = form.referenceName.trim();
    const company = form.companyName.trim();
    if (!ref || !company) {
      toast.error("Reference name and company name are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/distributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceName: ref,
          companyName: company,
          phoneNumber: form.phoneNumber.trim() || null,
          extension: form.extension.trim() || null,
          accountNumber: form.accountNumber.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add");
      }
      setForm(EMPTY);
      await fetchList();
      toast.success("Distributor added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add distributor");
    } finally {
      setSaving(false);
    }
  }, [form, fetchList]);

  const updateDistributor = useCallback(
    async (id: string) => {
      const ref = editForm.referenceName.trim();
      const company = editForm.companyName.trim();
      if (!ref || !company) {
        toast.error("Reference name and company name are required");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch(`/api/distributors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceName: ref,
            companyName: company,
            phoneNumber: editForm.phoneNumber.trim() || null,
            extension: editForm.extension.trim() || null,
            accountNumber: editForm.accountNumber.trim() || null,
            notes: editForm.notes.trim() || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
        setEditingId(null);
        setEditForm(EMPTY);
        await fetchList();
        toast.success("Distributor updated");
      } catch {
        toast.error("Failed to update distributor");
      } finally {
        setSaving(false);
      }
    },
    [editForm, fetchList]
  );

  const deleteDistributor = useCallback(
    async (id: string) => {
      if (!confirm("Delete this distributor?")) return;
      try {
        const res = await fetch(`/api/distributors/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        if (editingId === id) setEditingId(null);
        await fetchList();
        toast.success("Distributor removed");
      } catch {
        toast.error("Failed to delete distributor");
      }
    },
    [fetchList, editingId]
  );

  const startEdit = useCallback((d: Distributor) => {
    setEditingId(d.id);
    setEditForm({
      referenceName: d.referenceName,
      companyName: d.companyName,
      phoneNumber: d.phoneNumber ?? "",
      extension: d.extension ?? "",
      accountNumber: d.accountNumber ?? "",
      notes: d.notes ?? "",
    });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-8 text-center text-gray-500">
        Loading distributors…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Distributors</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your distributor contacts. Add and manage them on the go.
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Add distributor</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Reference name *</label>
            <input
              type="text"
              value={form.referenceName}
              onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="e.g. Richelieu, Distributor A"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Company name *</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="Official company name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="(555) 000-0000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Extension</label>
            <input
              type="text"
              value={form.extension}
              onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="ext. 123"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Your account number</label>
            <input
              type="text"
              value={form.accountNumber}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="Account # with this distributor"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="Optional notes"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addDistributor}
          disabled={saving || !form.referenceName.trim() || !form.companyName.trim()}
          className="mt-4 neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add distributor"}
        </button>
      </div>

      {/* List */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-700">
          {list.length} distributor{list.length !== 1 ? "s" : ""}
        </h2>
        {list.length === 0 ? (
          <p className="neo-panel-inset p-6 rounded-xl text-center text-sm text-gray-500">
            No distributors yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                {editingId === d.id ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Reference *</label>
                        <input
                          type="text"
                          value={editForm.referenceName}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, referenceName: e.target.value }))
                          }
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Company *</label>
                        <input
                          type="text"
                          value={editForm.companyName}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, companyName: e.target.value }))
                          }
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phoneNumber}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))
                          }
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Extension</label>
                        <input
                          type="text"
                          value={editForm.extension}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, extension: e.target.value }))
                          }
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs text-gray-600">Account #</label>
                        <input
                          type="text"
                          value={editForm.accountNumber}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, accountNumber: e.target.value }))
                          }
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs text-gray-600">Notes</label>
                        <textarea
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, notes: e.target.value }))
                          }
                          rows={2}
                          className="neo-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDistributor(d.id)}
                        disabled={saving}
                        className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(EMPTY);
                        }}
                        className="neo-btn px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{d.referenceName}</p>
                      <p className="text-sm text-gray-600">{d.companyName}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        {d.phoneNumber && (
                          <span>
                            {d.phoneNumber}
                            {d.extension && ` ext. ${d.extension}`}
                          </span>
                        )}
                        {d.accountNumber && (
                          <span>Account: {d.accountNumber}</span>
                        )}
                      </div>
                      {d.notes && (
                        <p className="mt-1 text-xs text-gray-500">{d.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="neo-btn px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDistributor(d.id)}
                        className="neo-btn px-2 py-1 text-xs text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
