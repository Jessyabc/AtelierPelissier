"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Project = {
  id: string;
  name: string;
  isDraft: boolean;
  jobNumber?: string | null;
  notes?: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
};

export function ClientTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: Project;
  onUpdate: () => void;
}) {
  const [jobNumber, setJobNumber] = useState(project.jobNumber ?? "");
  const [firstName, setFirstName] = useState(project.clientFirstName ?? "");
  const [lastName, setLastName] = useState(project.clientLastName ?? "");
  const [email, setEmail] = useState(project.clientEmail ?? "");
  const [phone, setPhone] = useState(project.clientPhone ?? "");
  const [address, setAddress] = useState(project.clientAddress ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setJobNumber(project.jobNumber ?? "");
    setFirstName(project.clientFirstName ?? "");
    setLastName(project.clientLastName ?? "");
    setEmail(project.clientEmail ?? "");
    setPhone(project.clientPhone ?? "");
    setAddress(project.clientAddress ?? "");
    setNotes(project.notes ?? "");
  }, [project]);

  const save = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobNumber: jobNumber.trim() || null,
          notes: notes.trim() || null,
          clientFirstName: firstName.trim() || null,
          clientLastName: lastName.trim() || null,
          clientEmail: email.trim() || null,
          clientPhone: phone.trim() || null,
          clientAddress: address.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      onUpdate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Client info saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      toast.error("Failed to save client info");
    } finally {
      setSaving(false);
    }
  }, [projectId, jobNumber, notes, firstName, lastName, email, phone, address, onUpdate]);

  // Auto-save draft after a short delay when fields change
  useEffect(() => {
    const payload = {
      jobNumber: jobNumber.trim() || null,
      notes: notes.trim() || null,
      clientFirstName: firstName.trim() || null,
      clientLastName: lastName.trim() || null,
      clientEmail: email.trim() || null,
      clientPhone: phone.trim() || null,
      clientAddress: address.trim() || null,
    };
    const same =
      (project.jobNumber ?? "") === jobNumber &&
      (project.notes ?? "") === notes &&
      (project.clientFirstName ?? "") === firstName &&
      (project.clientLastName ?? "") === lastName &&
      (project.clientEmail ?? "") === email &&
      (project.clientPhone ?? "") === phone &&
      (project.clientAddress ?? "") === address;
    if (same) return;

    const t = setTimeout(() => {
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.ok && onUpdate())
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [jobNumber, notes, firstName, lastName, email, phone, address, projectId, project.jobNumber, project.notes, project.clientFirstName, project.clientLastName, project.clientEmail, project.clientPhone, project.clientAddress, onUpdate]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Client information is required when you mark the project as saved. Job number is required for service calls. Auto-saves as you type.
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Job number</label>
        <input
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          className="w-full max-w-xs neo-input px-4 py-2.5"
          placeholder="e.g. MC-6199"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full neo-input px-4 py-2.5"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Last name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full neo-input px-4 py-2.5"
            placeholder="Last name"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full neo-input px-4 py-2.5"
          placeholder="client@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full neo-input px-4 py-2.5"
          placeholder="(555) 000-0000"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className="w-full neo-input px-4 py-2.5"
          placeholder="Street, city, postal code"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full neo-input px-4 py-2.5"
          placeholder="Free-form notes for this job"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save client info"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </div>
  );
}
