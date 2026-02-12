"use client";

/**
 * Service call tab for project pages. Uses the canonical ServiceCallForm from /service-calls.
 * Supports multiple service calls per project (MC-6199 - #1, #2, ...).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ServiceCallForm,
  type ServiceCallFormValue,
  type ServiceCallFormItem,
  type ProjectPrefill,
} from "@/components/ServiceCallForm";

type ServiceCall = {
  id: string;
  clientName: string | null;
  jobNumber: string | null;
  address: string | null;
  contactPerson: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  serviceDate: string | null;
  timeOfArrival: string | null;
  timeOfDeparture: string | null;
  technicianName: string | null;
  serviceCallNumber: string | null;
  serviceCallType: string | null;
  reasonForService: string | null;
  workPerformed: string | null;
  checklistJson: string | null;
  notes: string | null;
  serviceCompleted: boolean | null;
  additionalVisitRequired: boolean | null;
  additionalVisitReason: string | null;
  estimatedFollowUpDate: string | null;
  satisfactionJson: string | null;
  clientAcknowledgmentType: string | null;
  followUpReason: string | null;
  clientSignature: string | null;
  responsibleSignature: string | null;
  items: ServiceCallFormItem[];
};

type Project = {
  jobNumber?: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientEmail?: string | null;
};

function toFormValue(sc: ServiceCall): ServiceCallFormValue {
  return {
    clientName: sc.clientName,
    jobNumber: sc.jobNumber,
    address: sc.address,
    contactPerson: sc.contactPerson,
    clientPhone: sc.clientPhone,
    clientEmail: sc.clientEmail,
    serviceDate: sc.serviceDate,
    timeOfArrival: sc.timeOfArrival,
    timeOfDeparture: sc.timeOfDeparture,
    technicianName: sc.technicianName,
    serviceCallNumber: sc.serviceCallNumber,
    serviceCallType: sc.serviceCallType,
    reasonForService: sc.reasonForService,
    workPerformed: sc.workPerformed,
    checklistJson: sc.checklistJson,
    serviceCompleted: sc.serviceCompleted,
    additionalVisitRequired: sc.additionalVisitRequired,
    additionalVisitReason: sc.additionalVisitReason,
    estimatedFollowUpDate: sc.estimatedFollowUpDate,
    satisfactionJson: sc.satisfactionJson,
    clientAcknowledgmentType: sc.clientAcknowledgmentType,
    followUpReason: sc.followUpReason,
    clientSignature: sc.clientSignature,
    responsibleSignature: sc.responsibleSignature,
    notes: sc.notes,
  };
}

export function ServiceCallsTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const [list, setList] = useState<ServiceCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemProvidedBy, setNewItemProvidedBy] = useState<"" | "company" | "client">("");
  const [addingItem, setAddingItem] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/service-calls`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
      setSelectedId((prev) => (prev && data.some((sc: ServiceCall) => sc.id === prev) ? prev : data[0]?.id ?? null));
    } catch {
      setList([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = list.find((sc) => sc.id === selectedId);
  const hasJobNumber = !!project.jobNumber?.trim();

  const save = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        clientName: selected.clientName?.trim() || null,
        jobNumber: selected.jobNumber?.trim() || null,
        address: selected.address?.trim() || null,
        contactPerson: selected.contactPerson?.trim() || null,
        clientPhone: selected.clientPhone?.trim() || null,
        clientEmail: selected.clientEmail?.trim() || null,
        serviceDate: selected.serviceDate || null,
        timeOfArrival: selected.timeOfArrival || null,
        timeOfDeparture: selected.timeOfDeparture || null,
        technicianName: selected.technicianName?.trim() || null,
        serviceCallType: selected.serviceCallType || null,
        reasonForService: selected.reasonForService?.trim() || null,
        workPerformed: selected.workPerformed?.trim() || null,
        checklistJson: selected.checklistJson || null,
        notes: selected.notes?.trim() || null,
        serviceCompleted: selected.serviceCompleted,
        additionalVisitRequired: selected.additionalVisitRequired,
        additionalVisitReason: selected.additionalVisitReason?.trim() || null,
        estimatedFollowUpDate: selected.estimatedFollowUpDate || null,
        satisfactionJson: selected.satisfactionJson || null,
        clientAcknowledgmentType: selected.clientAcknowledgmentType || null,
        followUpReason: selected.followUpReason?.trim() || null,
        clientSignature: selected.clientSignature || null,
        responsibleSignature: selected.responsibleSignature || null,
      };
      const res = await fetch(`/api/projects/${projectId}/service-calls/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchList();
      onUpdate();
      const calUrl = selected.serviceDate
        ? `/calendar?year=${new Date(selected.serviceDate).getFullYear()}&month=${new Date(selected.serviceDate).getMonth() + 1}`
        : "/calendar";
      toast.success(
        (t) => (
          <span>
            Service call saved.{" "}
            <Link href={calUrl} className="font-medium underline" onClick={() => toast.dismiss(t.id)}>
              View in calendar
            </Link>
          </span>
        ),
        { duration: 6000 }
      );
    } catch {
      toast.error("Failed to save service call");
    } finally {
      setSaving(false);
    }
  }, [projectId, selected, fetchList, onUpdate]);

  const createNew = useCallback(async () => {
    if (!hasJobNumber) {
      toast.error("Set job number in the Client tab first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/service-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create");
      }
      const created = await res.json();
      await fetchList();
      setSelectedId(created.id);
      onUpdate();
      toast.success("Service call added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add service call");
    } finally {
      setCreating(false);
    }
  }, [projectId, hasJobNumber, fetchList, onUpdate]);

  const addItem = useCallback(
    async (item: { description: string; quantity?: string | null; providedBy?: string | null }) => {
      if (!selected) return;
      const desc = item.description.trim();
      if (!desc) return;
      setAddingItem(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/service-calls/${selected.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: desc,
            quantity: item.quantity ?? null,
            providedBy: item.providedBy ?? null,
          }),
        });
        if (!res.ok) throw new Error("Failed to add item");
        setNewItemDesc("");
        setNewItemQty("");
        setNewItemProvidedBy("");
        await fetchList();
        onUpdate();
        toast.success("Item added");
      } catch {
        toast.error("Failed to add item");
      } finally {
        setAddingItem(false);
      }
    },
    [projectId, selected, fetchList, onUpdate]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!selected) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/service-calls/${selected.id}/items/${itemId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove");
        await fetchList();
        onUpdate();
        toast.success("Item removed");
      } catch {
        toast.error("Failed to remove item");
      }
    },
    [projectId, selected, fetchList, onUpdate]
  );

  const addFile = useCallback(
    async (itemId: string, file: File) => {
      if (!selected) return;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(
          `/api/projects/${projectId}/service-calls/${selected.id}/items/${itemId}/files`,
          { method: "POST", body: formData }
        );
        if (!res.ok) throw new Error("Failed to upload");
        await fetchList();
        onUpdate();
        toast.success(`Added ${file.name}`);
      } catch {
        toast.error("Failed to add file");
      }
    },
    [projectId, selected, fetchList, onUpdate]
  );

  const removeFile = useCallback(
    async (itemId: string, fileId: string) => {
      if (!selected) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/service-calls/${selected.id}/items/${itemId}/files/${fileId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove");
        await fetchList();
        onUpdate();
        toast.success("File removed");
      } catch {
        toast.error("Failed to remove file");
      }
    },
    [projectId, selected, fetchList, onUpdate]
  );

  const update = useCallback(
    <K extends keyof ServiceCallFormValue>(key: K, value: ServiceCallFormValue[K]) => {
      setList((prev) =>
        prev.map((sc) =>
          sc.id === selectedId ? { ...sc, [key]: value } : sc
        )
      );
    },
    [selectedId]
  );

  const projectPrefill: ProjectPrefill = {
    clientFirstName: project.clientFirstName,
    clientLastName: project.clientLastName,
    clientPhone: project.clientPhone,
    clientAddress: project.clientAddress,
    clientEmail: project.clientEmail,
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading service calls…</div>;
  }

  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Add a service call for this project. Job number must be set in the Client tab first.
        </p>
        <button
          type="button"
          onClick={createNew}
          disabled={creating || !hasJobNumber}
          className="btn-primary rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {creating ? "Creating…" : "Add service call"}
        </button>
        {!hasJobNumber && (
          <p className="text-sm text-amber-600">Set the job number in the Client tab to enable service calls.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
        >
          {list.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.serviceCallNumber || `Service call ${list.indexOf(sc) + 1}`}
              {sc.serviceDate && ` · ${new Date(sc.serviceDate).toLocaleDateString("en-CA")}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={createNew}
          disabled={creating || !hasJobNumber}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {creating ? "…" : "+ Add"}
        </button>
      </div>

      {selected && (
        <ServiceCallForm
          value={toFormValue(selected)}
          onChange={update}
          items={selected.items}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          projectPrefill={projectPrefill}
          newItemDesc={newItemDesc}
          onNewItemDescChange={setNewItemDesc}
          newItemQty={newItemQty}
          onNewItemQtyChange={setNewItemQty}
          newItemProvidedBy={newItemProvidedBy}
          onNewItemProvidedByChange={setNewItemProvidedBy}
          addingItem={addingItem}
          onAddFile={addFile}
          onRemoveFile={removeFile}
          renderActions={() => (
            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => window.print()}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Print
              </button>
            </div>
          )}
        />
      )}
    </div>
  );
}
