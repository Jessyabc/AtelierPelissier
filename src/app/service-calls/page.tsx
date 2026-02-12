"use client";

/**
 * Service calls section: list all service calls, create new, print list, view in calendar.
 * When a service call is saved with a date, it appears on the calendar immediately.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ServiceCallForm,
  EMPTY_SERVICE_CALL_FORM,
  generateItemId,
  type ServiceCallFormValue,
  type ServiceCallFormItem,
} from "@/components/ServiceCallForm";
import { parseServiceCallTypesJson } from "@/lib/serviceCallTypes";

type ServiceCallListItem = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  jobNumber: string | null;
  serviceCallNumber: string | null;
  serviceDate: string | null;
  timeOfArrival: string | null;
  serviceCallType: string | null;
  address: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function calendarUrlForDate(serviceDate: string | null | undefined): string {
  if (!serviceDate) return "/calendar";
  try {
    const d = new Date(serviceDate);
    return `/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`;
  } catch {
    return "/calendar";
  }
}

export default function ServiceCallsPage() {
  const [list, setList] = useState<ServiceCallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState<ServiceCallFormValue>(EMPTY_SERVICE_CALL_FORM);
  const [items, setItems] = useState<ServiceCallFormItem[]>([]);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemProvidedBy, setNewItemProvidedBy] = useState<"" | "company" | "client">("");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdDate, setCreatedDate] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-calls?t=${Date.now()}`, { cache: "no-store", headers: { Pragma: "no-cache" } });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to load service calls");
        setList([]);
      } else {
        setList(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Failed to load service calls");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Refetch when tab becomes visible (e.g. returned from calendar) so list stays in sync
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchList();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchList]);

  const update = useCallback(<K extends keyof ServiceCallFormValue>(key: K, value: ServiceCallFormValue[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addItem = useCallback(
    (item: { description: string; quantity?: string | null; providedBy?: string | null }) => {
      const desc = item.description.trim();
      if (!desc) return;
      setItems((prev) => [
        ...prev,
        { id: generateItemId(), description: desc, quantity: item.quantity, providedBy: item.providedBy },
      ]);
      setNewItemDesc("");
      setNewItemQty("");
      setNewItemProvidedBy("");
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setCreatedId(null);
    setCreatedDate(null);
    try {
      const payload = {
        clientName: form.clientName?.trim() || null,
        jobNumber: form.jobNumber?.trim() || null,
        address: form.address?.trim() || null,
        contactPerson: form.contactPerson?.trim() || null,
        clientPhone: form.clientPhone?.trim() || null,
        clientEmail: form.clientEmail?.trim() || null,
        serviceDate: form.serviceDate || null,
        timeOfArrival: form.timeOfArrival || null,
        timeOfDeparture: form.timeOfDeparture || null,
        technicianName: form.technicianName?.trim() || null,
        serviceCallNumber: form.serviceCallNumber?.trim() || null,
        serviceCallType: form.serviceCallType || null,
        reasonForService: form.reasonForService?.trim() || null,
        workPerformed: form.workPerformed?.trim() || null,
        checklistJson: form.checklistJson || null,
        serviceCompleted: form.serviceCompleted,
        additionalVisitRequired: form.additionalVisitRequired,
        additionalVisitReason: form.additionalVisitReason?.trim() || null,
        estimatedFollowUpDate: form.estimatedFollowUpDate || null,
        satisfactionJson: form.satisfactionJson || null,
        clientAcknowledgmentType: form.clientAcknowledgmentType || null,
        followUpReason: form.followUpReason?.trim() || null,
        clientSignature: form.clientSignature || null,
        responsibleSignature: form.responsibleSignature || null,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity || null,
          providedBy: i.providedBy || null,
        })),
      };
      const res = await fetch("/api/service-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create");
      setCreatedId(data.projectId);
      setCreatedDate(form.serviceDate || null);
      await fetchList();
      toast.success("Service call saved");
      setShowCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create service call");
    } finally {
      setSaving(false);
    }
  }, [form, items, fetchList]);

  const createAnother = useCallback(() => {
    setForm(EMPTY_SERVICE_CALL_FORM);
    setItems([]);
    setNewItemDesc("");
    setNewItemQty("");
    setNewItemProvidedBy("");
    setCreatedId(null);
    setCreatedDate(null);
  }, []);

  const handlePrintList = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Printable list — hidden by default, shown when printing */}
      <div id="service-calls-list-print" className="hidden print:block">
        <h1 className="mb-4 text-lg font-bold text-gray-900">Service Calls</h1>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-2 text-left font-semibold">Job #</th>
              <th className="py-2 text-left font-semibold">Client</th>
              <th className="py-2 text-left font-semibold">Date</th>
              <th className="py-2 text-left font-semibold">Time</th>
              <th className="py-2 text-left font-semibold">Type</th>
              <th className="py-2 text-left font-semibold">Address</th>
            </tr>
          </thead>
          <tbody>
            {list.map((sc) => {
              const types = parseServiceCallTypesJson(sc.serviceCallType ?? null);
              const typeStr = types.length ? types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "—";
              return (
                <tr key={sc.id} className="border-b border-gray-100">
                  <td className="py-2">{sc.jobNumber || sc.serviceCallNumber || "—"}</td>
                  <td className="py-2">{sc.clientName}</td>
                  <td className="py-2">{formatDate(sc.serviceDate)}</td>
                  <td className="py-2">{formatTime(sc.timeOfArrival)}</td>
                  <td className="py-2">{typeStr}</td>
                  <td className="py-2">{sc.address || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-gray-500">
          Atelier Pelissier · {list.length} service call(s) · {new Date().toLocaleDateString("en-CA")}
        </p>
      </div>

      <div className="print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Service calls</h1>
          <p className="mt-1 text-sm text-gray-600">
            List all service calls, create new ones, print, or view in the calendar.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary rounded px-4 py-2 text-sm font-medium"
          >
            New service call
          </button>
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={loading}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh list"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePrintList}
            disabled={list.length === 0}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Print list
          </button>
          <Link
            href="/calendar"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View calendar
          </Link>
        </div>

        {/* Success message after creating — with View in calendar */}
        {createdId && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            <p className="font-medium">Service call saved.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={calendarUrlForDate(createdDate)}
                className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
              >
                View in calendar
              </Link>
              <Link
                href={`/projects/${createdId}`}
                className="rounded border border-green-300 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                Open project
              </Link>
              <button
                type="button"
                onClick={createAnother}
                className="rounded border border-green-300 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                Create another
              </button>
            </div>
          </div>
        )}

        {/* Saved service calls */}
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Saved service calls</h2>
          {loading ? (
            <p className="py-8 text-center text-gray-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No service calls yet. Create one to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((sc) => {
                const types = parseServiceCallTypesJson(sc.serviceCallType ?? null);
                const typeStr = types.length ? types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "";
                const calUrl = calendarUrlForDate(sc.serviceDate);
                return (
                  <li
                    key={sc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">
                        {sc.jobNumber || sc.serviceCallNumber || "—"}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">{sc.clientName}</span>
                      <span className="ml-2 text-sm text-gray-500">{formatDate(sc.serviceDate)}</span>
                      {sc.timeOfArrival && (
                        <span className="ml-2 text-sm text-gray-500">{formatTime(sc.timeOfArrival)}</span>
                      )}
                      {typeStr && (
                        <span className="ml-2 text-xs text-gray-500">· {typeStr}</span>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <Link
                        href={`/projects/${sc.projectId}`}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Open
                      </Link>
                      <Link
                        href={calUrl}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View in calendar
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Create form (modal-like when showCreate) */}
        {showCreate && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">New service call</h2>
            <ServiceCallForm
              value={form}
              onChange={update}
              items={items}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              newItemDesc={newItemDesc}
              onNewItemDescChange={setNewItemDesc}
              newItemQty={newItemQty}
              onNewItemQtyChange={setNewItemQty}
              newItemProvidedBy={newItemProvidedBy}
              onNewItemProvidedByChange={setNewItemProvidedBy}
              renderActions={() => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="btn-primary rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save service call"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
