"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PROJECT_TYPES = [
  { value: "vanity", label: "Vanity" },
  { value: "side_unit", label: "Side Unit" },
  { value: "kitchen", label: "Kitchen" },
] as const;

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
};

type TaskDraft = { name: string; items: string[]; processTemplateId?: string };

const SIDEBAR_TIPS = [
  {
    title: "Invoice / Job number",
    text: "This is the project's primary identifier (e.g. MC-6199). Use it on quotes, orders, and service calls.",
  },
  {
    title: "Find existing clients",
    text: "Type a name, email, or phone to search. Picking an existing client avoids duplicates and links projects to the same contact.",
  },
  {
    title: "Multiple clients",
    text: "Some projects (e.g. joint ownership) have 2 clients. Add a second client when needed.",
  },
  {
    title: "Second phone number",
    text: "Clients often have home and cell numbers. Add both for easier reach.",
  },
  {
    title: "Process template",
    text: "The Conception template seeds the 12-step workflow. You can customize steps later on the project page.",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["vanity"]);
  const [processTemplateId, setProcessTemplateId] = useState("");
  const [processTemplates, setProcessTemplates] = useState<Array<{ id: string; name: string }>>([]);

  // Client 1: search or create
  const [client1Mode, setClient1Mode] = useState<"search" | "create">("search");
  const [client1Search, setClient1Search] = useState("");
  const [client1Results, setClient1Results] = useState<Client[]>([]);
  const [client1Selected, setClient1Selected] = useState<Client | null>(null);
  const [client1Form, setClient1Form] = useState({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" });
  const client1SearchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Client 2: optional second client
  const [hasClient2, setHasClient2] = useState(false);
  const [client2Mode, setClient2Mode] = useState<"search" | "create">("search");
  const [client2Search, setClient2Search] = useState("");
  const [client2Results, setClient2Results] = useState<Client[]>([]);
  const [client2Selected, setClient2Selected] = useState<Client | null>(null);
  const [client2Form, setClient2Form] = useState({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" });
  const client2SearchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskItems, setNewTaskItems] = useState("");
  const [newTaskProcessId, setNewTaskProcessId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function toggleType(value: string) {
    setSelectedTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value];
      return next.length ? next : ["vanity"];
    });
  }

  function addTask() {
    if (!newTaskName.trim()) return;
    const items = newTaskItems.split("\n").map((s) => s.trim()).filter(Boolean);
    setTasks((t) => [
      ...t,
      { name: newTaskName.trim(), items, processTemplateId: newTaskProcessId.trim() || undefined },
    ]);
    setNewTaskName("");
    setNewTaskItems("");
    setNewTaskProcessId("");
  }

  function removeTask(idx: number) {
    setTasks((t) => t.filter((_, i) => i !== idx));
  }

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
    if (client1Search.length >= 2 && client1Mode === "search" && !client1Selected) {
      client1SearchTimeoutRef.current = setTimeout(() => searchClients(client1Search, setClient1Results), 300);
    } else {
      setClient1Results([]);
    }
    return () => {
      if (client1SearchTimeoutRef.current) clearTimeout(client1SearchTimeoutRef.current);
    };
  }, [client1Search, client1Mode, client1Selected, searchClients]);

  useEffect(() => {
    if (client2Search.length >= 2 && client2Mode === "search" && !client2Selected && hasClient2) {
      client2SearchTimeoutRef.current = setTimeout(() => searchClients(client2Search, setClient2Results), 300);
    } else {
      setClient2Results([]);
    }
    return () => {
      if (client2SearchTimeoutRef.current) clearTimeout(client2SearchTimeoutRef.current);
    };
  }, [client2Search, client2Mode, client2Selected, hasClient2, searchClients]);

  useEffect(() => {
    fetch("/api/process-templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const templates = Array.isArray(data) ? data : [];
        setProcessTemplates(templates);
        const conception = templates.find((t: { name: string }) => t.name === "Conception");
        if (conception) setProcessTemplateId(conception.id);
      })
      .catch(() => setProcessTemplates([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const jobNum = invoiceNumber.trim();
    const desc = projectDescription.trim();
    const name = desc ? `${jobNum || "Project"} — ${desc}` : jobNum || "New project";

    if (!jobNum && !desc) {
      setError("Enter an invoice/job number or a project description.");
      return;
    }

    if (selectedTypes.length === 0) {
      setError("Select at least one project type.");
      return;
    }

    setLoading(true);
    try {
      let clientId: string | null = null;
      let client: Record<string, string> | undefined;
      let client2Id: string | null = null;
      let client2: Record<string, string> | undefined;

      if (client1Selected) {
        clientId = client1Selected.id;
      } else if (client1Form.firstName.trim() && client1Form.lastName.trim()) {
        client = {
          firstName: client1Form.firstName.trim(),
          lastName: client1Form.lastName.trim(),
          ...(client1Form.email.trim() && { email: client1Form.email.trim() }),
          ...(client1Form.phone.trim() && { phone: client1Form.phone.trim() }),
          ...(client1Form.phone2.trim() && { phone2: client1Form.phone2.trim() }),
          ...(client1Form.address.trim() && { address: client1Form.address.trim() }),
        };
      }

      if (hasClient2) {
        if (client2Selected) {
          client2Id = client2Selected.id;
        } else if (client2Form.firstName.trim() && client2Form.lastName.trim()) {
          client2 = {
            firstName: client2Form.firstName.trim(),
            lastName: client2Form.lastName.trim(),
            ...(client2Form.email.trim() && { email: client2Form.email.trim() }),
            ...(client2Form.phone.trim() && { phone: client2Form.phone.trim() }),
            ...(client2Form.phone2.trim() && { phone2: client2Form.phone2.trim() }),
            ...(client2Form.address.trim() && { address: client2Form.address.trim() }),
          };
        }
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jobNumber: jobNum || undefined,
          types: selectedTypes,
          processTemplateId: processTemplateId.trim() || undefined,
          clientId: clientId ?? undefined,
          client: client ?? undefined,
          client2Id: client2Id ?? undefined,
          client2: client2 ?? undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues = data.issues as Record<string, string[] | undefined> | undefined;
        if (issues) setFieldErrors(issues as Record<string, string[]>);
        throw new Error(data.error || "Validation failed");
      }

      for (const task of tasks) {
        await fetch(`/api/projects/${data.id}/sub-projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: task.name,
            items: task.items,
            processTemplateId: task.processTemplateId,
          }),
        });
      }
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className="mb-6 text-xl font-semibold text-gray-900">New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="invoiceNumber" className="mb-1 block text-sm font-medium text-gray-700">
                Invoice / Job number <span className="text-amber-600">*</span>
              </label>
              <input
                id="invoiceNumber"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={`neo-input w-full px-4 py-2.5 ${fieldErrors.name ? "ring-2 ring-red-400" : ""}`}
                placeholder="e.g. MC-6199"
                aria-invalid={!!fieldErrors.name}
              />
              <p className="mt-0.5 text-xs text-gray-500">Primary project identifier for quotes and service calls</p>
            </div>
            <div>
              <label htmlFor="projectDescription" className="mb-1 block text-sm font-medium text-gray-700">
                Project description
              </label>
              <input
                id="projectDescription"
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="neo-input w-full px-4 py-2.5"
                placeholder="e.g. Main bath vanity"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Project type (select all that apply)</span>
            <div className="flex flex-wrap gap-4">
              {PROJECT_TYPES.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(value)}
                    onChange={() => toggleType(value)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-800">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="processTemplate" className="mb-1 block text-sm font-medium text-gray-700">
              Process template
            </label>
            <select
              id="processTemplate"
              value={processTemplateId}
              onChange={(e) => setProcessTemplateId(e.target.value)}
              className="neo-input w-full max-w-sm px-4 py-2.5"
            >
              <option value="">— None —</option>
              {processTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-gray-500">Workflow checklist will be seeded from the template (default: Conception)</p>
          </div>

          {/* Client 1 */}
          <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
            <legend className="text-sm font-medium text-gray-700">Primary client</legend>
            <p className="mb-4 text-xs text-gray-500">Search for an existing client or add a new one.</p>

            {client1Selected ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm">
                <div>
                  <p className="font-medium text-gray-900">
                    {client1Selected.firstName} {client1Selected.lastName}
                  </p>
                  <p className="text-xs text-gray-600">
                    {[client1Selected.email, client1Selected.phone].filter(Boolean).join(" · ") || "No contact"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClient1Selected(null); setClient1Search(""); setClient1Form({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" }); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setClient1Mode("search")}
                    className={`neo-btn px-3 py-1.5 text-xs ${client1Mode === "search" ? "neo-btn-pressed" : ""}`}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setClient1Mode("create")}
                    className={`neo-btn px-3 py-1.5 text-xs ${client1Mode === "create" ? "neo-btn-pressed" : ""}`}
                  >
                    New client
                  </button>
                </div>
                {client1Mode === "search" ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={client1Search}
                      onChange={(e) => setClient1Search(e.target.value)}
                      placeholder="Type name, email or phone…"
                      className="neo-input w-full px-4 py-2.5 text-sm"
                      autoComplete="off"
                    />
                    {client1Results.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        {client1Results.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setClient1Selected(c); setClient1Search(""); setClient1Results([]); }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                            >
                              <span className="font-medium">{c.firstName} {c.lastName}</span>
                              {c.email && <span className="ml-2 text-gray-500">{c.email}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={client1Form.firstName}
                        onChange={(e) => setClient1Form((f) => ({ ...f, firstName: e.target.value }))}
                        placeholder="First name"
                        className="neo-input px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={client1Form.lastName}
                        onChange={(e) => setClient1Form((f) => ({ ...f, lastName: e.target.value }))}
                        placeholder="Last name"
                        className="neo-input px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      type="email"
                      value={client1Form.email}
                      onChange={(e) => setClient1Form((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="neo-input w-full px-3 py-2 text-sm"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="tel"
                        value={client1Form.phone}
                        onChange={(e) => setClient1Form((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="neo-input px-3 py-2 text-sm"
                      />
                      <input
                        type="tel"
                        value={client1Form.phone2}
                        onChange={(e) => setClient1Form((f) => ({ ...f, phone2: e.target.value }))}
                        placeholder="Phone 2"
                        className="neo-input px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      value={client1Form.address}
                      onChange={(e) => setClient1Form((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Address"
                      rows={2}
                      className="neo-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* Client 2 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasClient2}
                onChange={(e) => {
                  setHasClient2(e.target.checked);
                  if (!e.target.checked) { setClient2Selected(null); setClient2Search(""); setClient2Form({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" }); }
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Add second client</span>
            </label>
            {hasClient2 && (
              <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
                <legend className="text-sm font-medium text-gray-600">Second client</legend>
                {client2Selected ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm">
                    <p className="font-medium text-gray-900">
                      {client2Selected.firstName} {client2Selected.lastName}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setClient2Selected(null); setClient2Search(""); setClient2Form({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" }); }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setClient2Mode("search")}
                        className={`neo-btn px-3 py-1.5 text-xs ${client2Mode === "search" ? "neo-btn-pressed" : ""}`}
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => setClient2Mode("create")}
                        className={`neo-btn px-3 py-1.5 text-xs ${client2Mode === "create" ? "neo-btn-pressed" : ""}`}
                      >
                        New client
                      </button>
                    </div>
                    {client2Mode === "search" ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={client2Search}
                          onChange={(e) => setClient2Search(e.target.value)}
                          placeholder="Type name, email or phone…"
                          className="neo-input w-full px-4 py-2.5 text-sm"
                          autoComplete="off"
                        />
                        {client2Results.length > 0 && (
                          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            {client2Results.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => { setClient2Selected(c); setClient2Search(""); setClient2Results([]); }}
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
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input type="text" value={client2Form.firstName} onChange={(e) => setClient2Form((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="neo-input px-3 py-2 text-sm" />
                          <input type="text" value={client2Form.lastName} onChange={(e) => setClient2Form((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="neo-input px-3 py-2 text-sm" />
                        </div>
                        <input type="email" value={client2Form.email} onChange={(e) => setClient2Form((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="neo-input w-full px-3 py-2 text-sm" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input type="tel" value={client2Form.phone} onChange={(e) => setClient2Form((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="neo-input px-3 py-2 text-sm" />
                          <input type="tel" value={client2Form.phone2} onChange={(e) => setClient2Form((f) => ({ ...f, phone2: e.target.value }))} placeholder="Phone 2" className="neo-input px-3 py-2 text-sm" />
                        </div>
                        <textarea value={client2Form.address} onChange={(e) => setClient2Form((f) => ({ ...f, address: e.target.value }))} placeholder="Address" rows={2} className="neo-input w-full px-3 py-2 text-sm" />
                      </div>
                    )}
                  </>
                )}
              </fieldset>
            )}
          </div>

          {/* Tasks */}
          <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
            <legend className="text-sm font-medium text-gray-700">Tasks (optional)</legend>
            <p className="mb-4 text-xs text-gray-500">Add follow-up tasks now or from the project page.</p>
            {tasks.length > 0 && (
              <ul className="mb-4 space-y-2">
                {tasks.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <button type="button" onClick={() => removeTask(i)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Task name"
                className="neo-input flex-1 px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
              />
              <select value={newTaskProcessId} onChange={(e) => setNewTaskProcessId(e.target.value)} className="neo-input w-36 px-3 py-2 text-sm shrink-0">
                <option value="">No process</option>
                {processTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button type="button" onClick={addTask} disabled={!newTaskName.trim()} className="neo-btn px-3 py-2 text-sm shrink-0">
                Add
              </button>
            </div>
            {newTaskName.trim() && (
              <textarea
                value={newTaskItems}
                onChange={(e) => setNewTaskItems(e.target.value)}
                placeholder="Items (one per line)"
                rows={2}
                className="neo-input mt-2 w-full px-3 py-2 text-sm"
              />
            )}
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? "Creating…" : "Create project (draft)"}
            </button>
            <button type="button" onClick={() => router.push("/")} className="neo-btn px-4 py-2.5 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-5">
          <h3 className="text-sm font-medium text-gray-700">Tips</h3>
          <ul className="space-y-4">
            {SIDEBAR_TIPS.map((tip, i) => (
              <li key={i}>
                <p className="text-xs font-medium text-gray-800">{tip.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">{tip.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
