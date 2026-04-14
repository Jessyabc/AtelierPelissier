"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type RoomType = { value: string; label: string; icon: string; desc: string };

const FALLBACK_ROOM_TYPES: RoomType[] = [
  { value: "kitchen", label: "Kitchen", icon: "🍳", desc: "Cabinets, countertops, islands" },
  { value: "vanity", label: "Vanity / Bathroom", icon: "🚿", desc: "Vanities, medicine cabinets" },
  { value: "closet", label: "Closet / Storage", icon: "🗄", desc: "Walk-in, reach-in, pantry" },
  { value: "commercial", label: "Commercial / Office", icon: "🏢", desc: "Reception, built-ins" },
  { value: "laundry", label: "Laundry Room", icon: "🧺", desc: "Laundry cabinetry" },
  { value: "entertainment", label: "Entertainment Center", icon: "📺", desc: "Wall units, media" },
  { value: "custom", label: "Custom Piece", icon: "🔨", desc: "Shelves, furniture, one-offs" },
];

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
};

type ProcessTemplate = { id: string; name: string };

// Sales lifecycle stage — drives getNextAction, projects-list grouping, and
// the deposit field. See src/lib/workflow/nextAction.ts for semantics.
type Stage = "quote" | "invoiced" | "confirmed";

export default function NewProjectPage() {
  const router = useRouter();
  // Step 0 = stage picker, 1 = basics, 2 = rooms, 3 = review.
  const [step, setStep] = useState(0);

  // Step 0: sales lifecycle stage
  const [stage, setStage] = useState<Stage>("quote");

  // Step 1: basics
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  // Client
  const [clientMode, setClientMode] = useState<"search" | "create">("search");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSelected, setClientSelected] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [hasClient2, setHasClient2] = useState(false);
  const [client2Mode, setClient2Mode] = useState<"search" | "create">("search");
  const [client2Search, setClient2Search] = useState("");
  const [client2Results, setClient2Results] = useState<Client[]>([]);
  const [client2Selected, setClient2Selected] = useState<Client | null>(null);
  const [client2Form, setClient2Form] = useState({ firstName: "", lastName: "", email: "", phone: "", phone2: "", address: "" });
  const search2TimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Step 2: rooms
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomLabels, setRoomLabels] = useState<Record<string, string>>({});

  // Room types (loaded from config, with built-in fallback)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(FALLBACK_ROOM_TYPES);

  // Process templates
  const [processTemplates, setProcessTemplates] = useState<ProcessTemplate[]>([]);
  const [projectProcessId, setProjectProcessId] = useState("");

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Target date
  const [targetDate, setTargetDate] = useState("");

  // File-drop intake (optional) — drop a PDF invoice to pre-fill the wizard
  const [parsingInvoice, setParsingInvoice] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleInvoiceFile = useCallback(async (file: File) => {
    if (!file) return;
    setParsingInvoice(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/projects/parse-invoice", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Could not parse invoice");
        return;
      }
      const x = data?.extracted as {
        invoiceNumber?: string;
        description?: string;
        client?: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string };
      } | undefined;
      if (!x) {
        toast.error("Nothing extracted from the file");
        return;
      }
      if (x.invoiceNumber) setInvoiceNumber(x.invoiceNumber);
      if (x.description) setProjectDescription(x.description);
      if (x.client) {
        setClientMode("create");
        setClientForm((prev) => ({
          firstName: x.client?.firstName ?? prev.firstName,
          lastName: x.client?.lastName ?? prev.lastName,
          email: x.client?.email ?? prev.email,
          phone: x.client?.phone ?? prev.phone,
          phone2: prev.phone2,
          address: x.client?.address ?? prev.address,
        }));
      }
      if (data?.warning) {
        toast(data.warning, { duration: 5000 });
      } else {
        toast.success("Invoice fields pre-filled — review and continue");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setParsingInvoice(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleInvoiceFile(file);
    },
    [handleInvoiceFile]
  );

  const searchClients = useCallback(async (q: string, setResults: (c: Client[]) => void) => {
    if (!q || q.length < 2) { setResults([]); return; }
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}&limit=15`);
      setResults(await res.json());
    } catch { setResults([]); }
  }, []);

  useEffect(() => {
    if (clientSearch.length >= 2 && clientMode === "search" && !clientSelected) {
      searchTimeoutRef.current = setTimeout(() => searchClients(clientSearch, setClientResults), 300);
    } else { setClientResults([]); }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [clientSearch, clientMode, clientSelected, searchClients]);

  useEffect(() => {
    if (client2Search.length >= 2 && client2Mode === "search" && !client2Selected && hasClient2) {
      search2TimeoutRef.current = setTimeout(() => searchClients(client2Search, setClient2Results), 300);
    } else { setClient2Results([]); }
    return () => { if (search2TimeoutRef.current) clearTimeout(search2TimeoutRef.current); };
  }, [client2Search, client2Mode, client2Selected, hasClient2, searchClients]);

  useEffect(() => {
    fetch("/api/process-templates").then((r) => r.ok ? r.json() : []).then((data) => {
      const t = Array.isArray(data) ? data : [];
      setProcessTemplates(t);
      const conception = t.find((x: ProcessTemplate) => x.name === "Conception");
      if (conception) setProjectProcessId(conception.id);
    }).catch(() => {});

    fetch("/api/admin/config").then((r) => r.ok ? r.json() : null).then((cfg) => {
      if (!cfg) return;
      const builtIn: RoomType[] = FALLBACK_ROOM_TYPES;
      const custom: RoomType[] = Array.isArray(cfg.customRoomTypes) ? cfg.customRoomTypes : [];
      setRoomTypes([...builtIn, ...custom]);
    }).catch(() => {});
  }, []);

  function toggleRoom(value: string) {
    setSelectedRooms((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]);
  }

  async function handleCreate() {
    setError("");
    const jobNum = invoiceNumber.trim();
    const desc = projectDescription.trim();
    const name = desc ? `${jobNum || "Project"} — ${desc}` : jobNum || "New project";

    if (!jobNum && !desc) { setError("Enter a job number or description."); return; }

    setLoading(true);
    try {
      let clientId: string | null = null;
      let client: Record<string, string> | undefined;
      let client2Id: string | null = null;
      let client2: Record<string, string> | undefined;

      if (clientSelected) { clientId = clientSelected.id; }
      else if (clientForm.firstName.trim() && clientForm.lastName.trim()) {
        client = { firstName: clientForm.firstName.trim(), lastName: clientForm.lastName.trim() };
        if (clientForm.email.trim()) client.email = clientForm.email.trim();
        if (clientForm.phone.trim()) client.phone = clientForm.phone.trim();
        if (clientForm.phone2.trim()) client.phone2 = clientForm.phone2.trim();
        if (clientForm.address.trim()) client.address = clientForm.address.trim();
      }

      if (hasClient2) {
        if (client2Selected) { client2Id = client2Selected.id; }
        else if (client2Form.firstName.trim() && client2Form.lastName.trim()) {
          client2 = { firstName: client2Form.firstName.trim(), lastName: client2Form.lastName.trim() };
          if (client2Form.email.trim()) client2.email = client2Form.email.trim();
          if (client2Form.phone.trim()) client2.phone = client2Form.phone.trim();
          if (client2Form.phone2.trim()) client2.phone2 = client2Form.phone2.trim();
          if (client2Form.address.trim()) client2.address = client2Form.address.trim();
        }
      }

      const types = selectedRooms.length > 0 ? selectedRooms : ["custom"];

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jobNumber: jobNum || undefined,
          types,
          stage,
          // depositReceivedAt is stamped server-side when stage === "confirmed"
          // unless the client provides one explicitly.
          processTemplateId: projectProcessId.trim() || undefined,
          clientId: clientId ?? undefined,
          client: client ?? undefined,
          client2Id: client2Id ?? undefined,
          client2: client2 ?? undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      // Auto-create rooms (ProjectItems) for each selected type
      for (const roomType of selectedRooms) {
        const label = roomLabels[roomType]?.trim() || roomTypes.find((r) => r.value === roomType)?.label || roomType;
        await fetch(`/api/projects/${data.id}/project-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: roomType, label }),
        });
      }

      router.push(`/projects/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6">New Project</h2>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s < step && setStep(s)}
              className={`w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center transition-colors ${
                s === step ? "bg-[var(--accent)] text-white" :
                s < step ? "bg-[var(--accent)]/20 text-[var(--accent)] cursor-pointer" :
                "bg-[var(--bg-light)] text-[var(--foreground-muted)]"
              }`}
            >
              {s < step ? "✓" : s + 1}
            </button>
            {s < 3 && <div className={`w-12 h-0.5 ${s < step ? "bg-[var(--accent)]" : "bg-[var(--bg-light)]"}`} />}
          </div>
        ))}
        <span className="text-xs text-[var(--foreground-muted)] ml-2">
          {step === 0 ? "Stage" : step === 1 ? "Basics" : step === 2 ? "What does this project include?" : "Review"}
        </span>
      </div>

      {/* Step 0: Sales stage — what kind of project is this right now? */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">What kind of project is this?</h3>
            <p className="text-sm text-[var(--foreground-muted)]">
              This drives the next-step guidance for everyone on the team. You can change it later from the project page.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {([
              {
                value: "quote" as const,
                icon: "💬",
                title: "Quick quote",
                desc: "Working estimate. No invoice yet.",
              },
              {
                value: "invoiced" as const,
                icon: "🧾",
                title: "Invoice issued",
                desc: "Invoice sent. No deposit yet.",
              },
              {
                value: "confirmed" as const,
                icon: "✅",
                title: "Deposit received",
                desc: "Greenlit for production.",
              },
            ]).map((opt) => {
              const selected = stage === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStage(opt.value)}
                  className={`neo-card p-4 text-left transition-all ${
                    selected ? "ring-2 ring-[var(--accent)] translate-y-[-2px]" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="text-2xl mb-1">{opt.icon}</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{opt.title}</div>
                  <div className="text-xs text-[var(--foreground-muted)] mt-1">{opt.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => router.push("/")} className="neo-btn px-4 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="neo-btn-primary px-6 py-2.5 text-sm font-medium"
            >
              Next: Basics
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Optional: drop a PDF invoice to pre-fill the wizard */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`neo-card flex flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-5 text-center text-sm transition-colors ${
              isDragging
                ? "border-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] text-[var(--foreground-muted)]"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              📄
            </span>
            <p className="font-medium text-[var(--foreground)]">
              {parsingInvoice ? "Parsing invoice…" : "Drop a PDF invoice to pre-fill"}
            </p>
            <p className="text-xs">
              or{" "}
              <label className="cursor-pointer text-[var(--accent-hover)] underline">
                choose a file
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={parsingInvoice}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleInvoiceFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              . We&rsquo;ll extract the job number, client, and contact info — review before continuing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Job / Invoice Number *</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="e.g. MC-6199" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Description</label>
              <input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="e.g. Full kitchen reno" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Target Date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Process Template</label>
              <select value={projectProcessId} onChange={(e) => setProjectProcessId(e.target.value)} className="neo-select w-full px-4 py-2.5 text-sm">
                <option value="">None</option>
                {processTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Primary Client */}
          <fieldset className="neo-card p-5">
            <legend className="text-sm font-semibold text-[var(--foreground)]">Primary Client</legend>
            {clientSelected ? (
              <div className="flex items-center justify-between gap-3 mt-2">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{clientSelected.firstName} {clientSelected.lastName}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">{[clientSelected.email, clientSelected.phone].filter(Boolean).join(" · ") || "No contact"}</p>
                </div>
                <button type="button" onClick={() => { setClientSelected(null); setClientSearch(""); }} className="text-xs text-red-500">Change</button>
              </div>
            ) : (
              <>
                <div className="neo-segment mt-2 mb-3">
                  <button type="button" onClick={() => setClientMode("search")} className={clientMode === "search" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>Search</button>
                  <button type="button" onClick={() => setClientMode("create")} className={clientMode === "create" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>New Client</button>
                </div>
                {clientMode === "search" ? (
                  <div className="relative">
                    <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Name, email, or phone..." className="neo-input w-full px-4 py-2.5 text-sm" autoComplete="off" />
                    {clientResults.length > 0 && (
                      <ul className="neo-dropdown absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto py-1">
                        {clientResults.map((c) => (
                          <li key={c.id}>
                            <button type="button" onClick={() => { setClientSelected(c); setClientSearch(""); setClientResults([]); }} className="w-full px-4 py-2 text-left text-sm hover:bg-white/50">
                              <span className="font-medium">{c.firstName} {c.lastName}</span>
                              {c.email && <span className="ml-2 text-[var(--foreground-muted)]">{c.email}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={clientForm.firstName} onChange={(e) => setClientForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name *" className="neo-input px-3 py-2 text-sm" />
                    <input value={clientForm.lastName} onChange={(e) => setClientForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name *" className="neo-input px-3 py-2 text-sm" />
                    <input value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="neo-input px-3 py-2 text-sm" />
                    <input value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="neo-input px-3 py-2 text-sm" />
                    <input value={clientForm.phone2} onChange={(e) => setClientForm((f) => ({ ...f, phone2: e.target.value }))} placeholder="Phone 2" className="neo-input px-3 py-2 text-sm" />
                    <textarea value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} placeholder="Address" rows={1} className="neo-input px-3 py-2 text-sm" />
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* Second client toggle */}
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
            <input type="checkbox" checked={hasClient2} onChange={(e) => setHasClient2(e.target.checked)} className="rounded" />
            Add second client
          </label>
          {hasClient2 && (
            <fieldset className="neo-card p-5">
              <legend className="text-sm font-semibold text-[var(--foreground)]">Second Client</legend>
              {client2Selected ? (
                <div className="flex items-center justify-between gap-3 mt-2">
                  <p className="font-medium text-[var(--foreground)]">{client2Selected.firstName} {client2Selected.lastName}</p>
                  <button type="button" onClick={() => { setClient2Selected(null); setClient2Search(""); }} className="text-xs text-red-500">Change</button>
                </div>
              ) : (
                <>
                  <div className="neo-segment mt-2 mb-3">
                    <button type="button" onClick={() => setClient2Mode("search")} className={client2Mode === "search" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>Search</button>
                    <button type="button" onClick={() => setClient2Mode("create")} className={client2Mode === "create" ? "neo-btn-primary px-3 py-1 text-xs" : "neo-segment-btn"}>New</button>
                  </div>
                  {client2Mode === "search" ? (
                    <div className="relative">
                      <input value={client2Search} onChange={(e) => setClient2Search(e.target.value)} placeholder="Search..." className="neo-input w-full px-4 py-2.5 text-sm" autoComplete="off" />
                      {client2Results.length > 0 && (
                        <ul className="neo-dropdown absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto py-1">
                          {client2Results.map((c) => (
                            <li key={c.id}><button type="button" onClick={() => { setClient2Selected(c); setClient2Search(""); setClient2Results([]); }} className="w-full px-4 py-2 text-left text-sm hover:bg-white/50">{c.firstName} {c.lastName}</button></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={client2Form.firstName} onChange={(e) => setClient2Form((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="neo-input px-3 py-2 text-sm" />
                      <input value={client2Form.lastName} onChange={(e) => setClient2Form((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="neo-input px-3 py-2 text-sm" />
                      <input value={client2Form.email} onChange={(e) => setClient2Form((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="neo-input px-3 py-2 text-sm" />
                      <input value={client2Form.phone} onChange={(e) => setClient2Form((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="neo-input px-3 py-2 text-sm" />
                    </div>
                  )}
                </>
              )}
            </fieldset>
          )}

          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setStep(0)} className="neo-btn px-4 py-2.5 text-sm">Back</button>
            <button type="button" onClick={() => { if (!invoiceNumber.trim() && !projectDescription.trim()) { setError("Enter a job number or description."); return; } setError(""); setStep(2); }} className="neo-btn-primary px-6 py-2.5 text-sm font-medium">
              Next: Rooms
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Rooms */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">What does this project include?</h3>
            <p className="text-sm text-[var(--foreground-muted)]">Select the rooms or pieces involved. Each will get its own process checklist and material tracking.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {roomTypes.map((room) => {
              const selected = selectedRooms.includes(room.value);
              return (
                <button
                  key={room.value}
                  type="button"
                  onClick={() => toggleRoom(room.value)}
                  className={`neo-card p-4 text-left transition-all ${selected ? "ring-2 ring-[var(--accent)] translate-y-[-2px]" : "opacity-70 hover:opacity-100"}`}
                >
                  <div className="text-xl mb-1">{room.icon}</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{room.label}</div>
                  <div className="text-[10px] text-[var(--foreground-muted)] mt-0.5">{room.desc}</div>
                  {selected && (
                    <input
                      type="text"
                      value={roomLabels[room.value] ?? ""}
                      onChange={(e) => { e.stopPropagation(); setRoomLabels((l) => ({ ...l, [room.value]: e.target.value })); }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`Label (e.g. ${room.label})`}
                      className="neo-input w-full px-2 py-1 text-xs mt-2"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[var(--foreground-muted)]">
            {selectedRooms.length === 0 ? "Skip this step if unsure — you can add rooms later." : `${selectedRooms.length} room${selectedRooms.length > 1 ? "s" : ""} selected`}
          </p>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="neo-btn px-4 py-2.5 text-sm">Back</button>
            <button type="button" onClick={() => setStep(3)} className="neo-btn-primary px-6 py-2.5 text-sm font-medium">Next: Review</button>
          </div>
        </div>
      )}

      {/* Step 3: Review + Create */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Review & Create</h3>

          <div className="neo-card p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--foreground-muted)]">Stage:</span>{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {stage === "quote" ? "Quick quote" : stage === "invoiced" ? "Invoice issued" : "Deposit received"}
                </span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)]">Job #:</span>{" "}
                <span className="font-medium text-[var(--foreground)]">{invoiceNumber || "—"}</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)]">Description:</span>{" "}
                <span className="font-medium text-[var(--foreground)]">{projectDescription || "—"}</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)]">Client:</span>{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {clientSelected ? `${clientSelected.firstName} ${clientSelected.lastName}` : clientForm.firstName ? `${clientForm.firstName} ${clientForm.lastName} (new)` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)]">Target:</span>{" "}
                <span className="font-medium text-[var(--foreground)]">{targetDate || "—"}</span>
              </div>
            </div>

            {selectedRooms.length > 0 && (
              <div>
                <span className="text-sm text-[var(--foreground-muted)]">Rooms:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedRooms.map((r) => {
                    const room = roomTypes.find((rt) => rt.value === r);
                    const label = roomLabels[r]?.trim() || room?.label || r;
                    return (
                      <span key={r} className="text-xs px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                        {room?.icon} {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="neo-btn px-4 py-2.5 text-sm">Back</button>
            <button type="button" onClick={handleCreate} disabled={loading} className="neo-btn-primary px-8 py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
