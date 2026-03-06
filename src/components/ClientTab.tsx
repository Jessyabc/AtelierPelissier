"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
};

type Project = {
  id: string;
  name: string;
  isDraft: boolean;
  jobNumber?: string | null;
  notes?: string | null;
  clientId?: string | null;
  client?: Client | null;
  client2Id?: string | null;
  client2?: Client | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientPhone2?: string | null;
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
  const [firstName, setFirstName] = useState(project.clientFirstName ?? project.client?.firstName ?? "");
  const [lastName, setLastName] = useState(project.clientLastName ?? project.client?.lastName ?? "");
  const [email, setEmail] = useState(project.clientEmail ?? project.client?.email ?? "");
  const [phone, setPhone] = useState(project.clientPhone ?? project.client?.phone ?? "");
  const [phone2, setPhone2] = useState(project.clientPhone2 ?? project.client?.phone2 ?? "");
  const [address, setAddress] = useState(project.clientAddress ?? project.client?.address ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [client2FirstName, setClient2FirstName] = useState(project.client2?.firstName ?? "");
  const [client2LastName, setClient2LastName] = useState(project.client2?.lastName ?? "");
  const [client2Email, setClient2Email] = useState(project.client2?.email ?? "");
  const [client2Phone, setClient2Phone] = useState(project.client2?.phone ?? "");
  const [client2Phone2, setClient2Phone2] = useState(project.client2?.phone2 ?? "");
  const [client2Address, setClient2Address] = useState(project.client2?.address ?? "");

  const [addingClient2, setAddingClient2] = useState(false);
  const [client2Mode, setClient2Mode] = useState<"search" | "create">("search");
  const [client2Search, setClient2Search] = useState("");
  const [client2Results, setClient2Results] = useState<Client[]>([]);
  const client2SearchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [primarySearch, setPrimarySearch] = useState("");
  const [primaryResults, setPrimaryResults] = useState<Client[]>([]);
  const primarySearchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const hasClient2 = !!project.client2Id || !!project.client2;

  useEffect(() => {
    setJobNumber(project.jobNumber ?? "");
    setFirstName(project.clientFirstName ?? project.client?.firstName ?? "");
    setLastName(project.clientLastName ?? project.client?.lastName ?? "");
    setEmail(project.clientEmail ?? project.client?.email ?? "");
    setPhone(project.clientPhone ?? project.client?.phone ?? "");
    setPhone2(project.clientPhone2 ?? project.client?.phone2 ?? "");
    setAddress(project.clientAddress ?? project.client?.address ?? "");
    setNotes(project.notes ?? "");
    setClient2FirstName(project.client2?.firstName ?? "");
    setClient2LastName(project.client2?.lastName ?? "");
    setClient2Email(project.client2?.email ?? "");
    setClient2Phone(project.client2?.phone ?? "");
    setClient2Phone2(project.client2?.phone2 ?? "");
    setClient2Address(project.client2?.address ?? "");
  }, [project]);

  const searchClients = useCallback(async (q: string, setResults: (c: Client[]) => void) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}&limit=15`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (client2Search.length >= 2 && client2Mode === "search" && addingClient2) {
      client2SearchTimeoutRef.current = setTimeout(() => searchClients(client2Search, setClient2Results), 300);
    } else {
      setClient2Results([]);
    }
    return () => {
      if (client2SearchTimeoutRef.current) clearTimeout(client2SearchTimeoutRef.current);
    };
  }, [client2Search, client2Mode, addingClient2, searchClients]);

  useEffect(() => {
    if (primarySearch.length >= 2) {
      primarySearchTimeoutRef.current = setTimeout(() => searchClients(primarySearch, setPrimaryResults), 300);
    } else {
      setPrimaryResults([]);
    }
    return () => {
      if (primarySearchTimeoutRef.current) clearTimeout(primarySearchTimeoutRef.current);
    };
  }, [primarySearch, searchClients]);

  const save = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        jobNumber: jobNumber.trim() || null,
        notes: notes.trim() || null,
        clientFirstName: firstName.trim() || null,
        clientLastName: lastName.trim() || null,
        clientEmail: email.trim() || null,
        clientPhone: phone.trim() || null,
        clientPhone2: phone2.trim() || null,
        clientAddress: address.trim() || null,
      };
      if (hasClient2) {
        payload.client2 = {
          firstName: client2FirstName.trim(),
          lastName: client2LastName.trim(),
          ...(client2Email.trim() && { email: client2Email.trim() }),
          ...(client2Phone.trim() && { phone: client2Phone.trim() }),
          ...(client2Phone2.trim() && { phone2: client2Phone2.trim() }),
          ...(client2Address.trim() && { address: client2Address.trim() }),
        };
      }
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
  }, [projectId, jobNumber, notes, firstName, lastName, email, phone, phone2, address, hasClient2, client2FirstName, client2LastName, client2Email, client2Phone, client2Phone2, client2Address, onUpdate]);

  const linkPrimaryClient = useCallback(async (client: Client) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      if (!res.ok) throw new Error("Failed to link");
      setPrimarySearch("");
      setPrimaryResults([]);
      onUpdate();
      toast.success("Saved client inserted");
    } catch {
      toast.error("Failed to insert client");
    } finally {
      setSaving(false);
    }
  }, [projectId, onUpdate]);

  const linkClient2 = useCallback(async (client: Client) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client2Id: client.id }),
      });
      if (!res.ok) throw new Error("Failed to link");
      setAddingClient2(false);
      setClient2Search("");
      setClient2Results([]);
      onUpdate();
      toast.success("Second client added");
    } catch {
      toast.error("Failed to add second client");
    } finally {
      setSaving(false);
    }
  }, [projectId, onUpdate]);

  const createAndLinkClient2 = useCallback(async () => {
    if (!client2FirstName.trim() || !client2LastName.trim()) return;
    setSaving(true);
    try {
      const body = {
        client2: {
          firstName: client2FirstName.trim(),
          lastName: client2LastName.trim(),
          email: client2Email.trim() || undefined,
          phone: client2Phone.trim() || undefined,
          phone2: client2Phone2.trim() || undefined,
          address: client2Address.trim() || undefined,
        },
      };
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      setAddingClient2(false);
      setClient2FirstName("");
      setClient2LastName("");
      setClient2Email("");
      setClient2Phone("");
      setClient2Phone2("");
      setClient2Address("");
      onUpdate();
      toast.success("Second client added");
    } catch {
      toast.error("Failed to add second client");
    } finally {
      setSaving(false);
    }
  }, [projectId, client2FirstName, client2LastName, client2Email, client2Phone, client2Phone2, client2Address, onUpdate]);

  const removeClient2 = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client2Id: null }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      onUpdate();
      toast.success("Second client removed");
    } catch {
      toast.error("Failed to remove second client");
    } finally {
      setSaving(false);
    }
  }, [projectId, onUpdate]);

  const primaryChanged =
    (project.jobNumber ?? "") !== jobNumber ||
    (project.notes ?? "") !== notes ||
    (project.clientFirstName ?? "") !== firstName ||
    (project.clientLastName ?? "") !== lastName ||
    (project.clientEmail ?? "") !== email ||
    (project.clientPhone ?? "") !== phone ||
    (project.clientPhone2 ?? "") !== phone2 ||
    (project.clientAddress ?? "") !== address;
  const client2Changed =
    hasClient2 &&
    ((project.client2?.firstName ?? "") !== client2FirstName ||
      (project.client2?.lastName ?? "") !== client2LastName ||
      (project.client2?.email ?? "") !== client2Email ||
      (project.client2?.phone ?? "") !== client2Phone ||
      (project.client2?.phone2 ?? "") !== client2Phone2 ||
      (project.client2?.address ?? "") !== client2Address);

  useEffect(() => {
    if (!primaryChanged && !client2Changed) return;
    const payload: Record<string, unknown> = {
      jobNumber: jobNumber.trim() || null,
      notes: notes.trim() || null,
      clientFirstName: firstName.trim() || null,
      clientLastName: lastName.trim() || null,
      clientEmail: email.trim() || null,
      clientPhone: phone.trim() || null,
      clientPhone2: phone2.trim() || null,
      clientAddress: address.trim() || null,
    };
    if (hasClient2) {
      payload.client2 = {
        firstName: client2FirstName.trim(),
        lastName: client2LastName.trim(),
        ...(client2Email.trim() && { email: client2Email.trim() }),
        ...(client2Phone.trim() && { phone: client2Phone.trim() }),
        ...(client2Phone2.trim() && { phone2: client2Phone2.trim() }),
        ...(client2Address.trim() && { address: client2Address.trim() }),
      };
    }
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
  }, [jobNumber, notes, firstName, lastName, email, phone, phone2, address, hasClient2, client2FirstName, client2LastName, client2Email, client2Phone, client2Phone2, client2Address, projectId, primaryChanged, client2Changed, project, onUpdate]);

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

      <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <legend className="text-sm font-medium text-gray-700">Primary client</legend>
        <div className="mt-4 mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Search saved client to insert</label>
          <div className="relative">
            <input
              type="text"
              value={primarySearch}
              onChange={(e) => setPrimarySearch(e.target.value)}
              placeholder="Type name, email or phone…"
              className="neo-input w-full px-4 py-2 text-sm"
              autoComplete="off"
            />
            {primaryResults.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {primaryResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => linkPrimaryClient(c)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      {c.firstName} {c.lastName}
                      {c.email && <span className="ml-2 text-gray-500">{c.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">First name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="First name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Last name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="Last name" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="client@example.com" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phone 2</label>
            <input type="tel" value={phone2} onChange={(e) => setPhone2(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="(555) 000-0001" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full neo-input px-4 py-2.5" placeholder="Street, city, postal code" />
        </div>
      </fieldset>

      {hasClient2 && (
        <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
          <legend className="flex items-center justify-between gap-2 text-sm font-medium text-gray-700">
            Second client
            <button type="button" onClick={removeClient2} disabled={saving} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">First name</label>
              <input type="text" value={client2FirstName} onChange={(e) => setClient2FirstName(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="First name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Last name</label>
              <input type="text" value={client2LastName} onChange={(e) => setClient2LastName(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="Last name" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input type="email" value={client2Email} onChange={(e) => setClient2Email(e.target.value)} className="w-full neo-input px-4 py-2.5" placeholder="client@example.com" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
              <input type="tel" value={client2Phone} onChange={(e) => setClient2Phone(e.target.value)} className="w-full neo-input px-4 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Phone 2</label>
              <input type="tel" value={client2Phone2} onChange={(e) => setClient2Phone2(e.target.value)} className="w-full neo-input px-4 py-2.5" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Address</label>
            <textarea value={client2Address} onChange={(e) => setClient2Address(e.target.value)} rows={2} className="w-full neo-input px-4 py-2.5" />
          </div>
        </fieldset>
      )}

      {!hasClient2 && !addingClient2 && (
        <button type="button" onClick={() => setAddingClient2(true)} className="text-sm text-[var(--accent-hover)] hover:underline">
          + Add second client
        </button>
      )}

      {addingClient2 && !hasClient2 && (
        <fieldset className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <legend className="text-sm font-medium text-amber-800">Add second client</legend>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setClient2Mode("search")} className={`neo-btn px-3 py-1.5 text-xs ${client2Mode === "search" ? "ring-2 ring-amber-500" : ""}`}>
              Search existing
            </button>
            <button type="button" onClick={() => setClient2Mode("create")} className={`neo-btn px-3 py-1.5 text-xs ${client2Mode === "create" ? "ring-2 ring-amber-500" : ""}`}>
              Create new
            </button>
          </div>
          {client2Mode === "search" ? (
            <div className="mt-4 relative">
              <input
                type="text"
                value={client2Search}
                onChange={(e) => setClient2Search(e.target.value)}
                placeholder="Type name, email or phone…"
                className="neo-input w-full px-4 py-2.5 text-sm"
                autoComplete="off"
              />
              {client2Results.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {client2Results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => linkClient2(c)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        {c.firstName} {c.lastName}
                        {c.email && <span className="ml-2 text-gray-500">{c.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="text" value={client2FirstName} onChange={(e) => setClient2FirstName(e.target.value)} placeholder="First name" className="neo-input px-3 py-2 text-sm" />
                <input type="text" value={client2LastName} onChange={(e) => setClient2LastName(e.target.value)} placeholder="Last name" className="neo-input px-3 py-2 text-sm" />
              </div>
              <input type="email" value={client2Email} onChange={(e) => setClient2Email(e.target.value)} placeholder="Email" className="neo-input w-full px-3 py-2 text-sm" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="tel" value={client2Phone} onChange={(e) => setClient2Phone(e.target.value)} placeholder="Phone" className="neo-input px-3 py-2 text-sm" />
                <input type="tel" value={client2Phone2} onChange={(e) => setClient2Phone2(e.target.value)} placeholder="Phone 2" className="neo-input px-3 py-2 text-sm" />
              </div>
              <textarea value={client2Address} onChange={(e) => setClient2Address(e.target.value)} placeholder="Address" rows={2} className="neo-input w-full px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={createAndLinkClient2} disabled={!client2FirstName.trim() || !client2LastName.trim() || saving} className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  Add
                </button>
                <button type="button" onClick={() => { setAddingClient2(false); setClient2Search(""); setClient2Results([]); }} className="neo-btn px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </fieldset>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full neo-input px-4 py-2.5" placeholder="Free-form notes for this job" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          {saving ? "Saving…" : "Save client info"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </div>
  );
}
