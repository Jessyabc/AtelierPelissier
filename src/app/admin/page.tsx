"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type {
  AppConfigData,
  MenuItem,
  RoomType,
  EmailTemplates,
} from "@/lib/config";

// ── Tab definitions ────────────────────────────────────────────────────

const TABS = [
  { id: "company", label: "Company" },
  { id: "navigation", label: "Navigation" },
  { id: "rooms", label: "Room Types" },
  { id: "ai", label: "AI Intelligence" },
  { id: "email", label: "Email Templates" },
  { id: "integrations", label: "Integrations" },
  { id: "health", label: "System Health" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type AppError = {
  id: string;
  source: string;
  severity: string;
  message: string;
  stack: string | null;
  route: string | null;
  context: string | null;
  aiDiagnosticPrompt: string | null;
  resolved: boolean;
  createdAt: string;
};

type ProcessTemplate = { id: string; name: string };

// ── Defaults for when no config exists yet ─────────────────────────────

const EMPTY_CONFIG: AppConfigData = {
  id: "",
  companyName: "Atelier Pelissier",
  companyEmail: null,
  companyPhone: null,
  companyAddress: null,
  logoUrl: null,
  menuConfig: [],
  customRoomTypes: [],
  processDefaults: {},
  materialAliases: {},
  emailTemplates: {
    supplierOrder: "",
    supplierReserve: "",
    clientFollowup: "",
  },
  integrations: {},
};

function AdminPageContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>("company");
  const [config, setConfig] = useState<AppConfigData>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
    const sage = searchParams.get("sage");
    const err = searchParams.get("error");
    const errDesc = searchParams.get("error_description");
    if (sage === "connected") setToast("Sage connected successfully");
    if (sage === "denied") {
      const msg = errDesc || err || "Sage authorization was cancelled";
      setToast(`Sage: ${msg}`);
    }
    if (sage === "exchange_failed" || sage === "missing_config") setToast("Sage connection failed. Check Client ID and Secret, then try again.");
  }, [searchParams]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) setConfig(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function saveConfig(patch: Partial<AppConfigData>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setConfig(await res.json());
        setToast("Saved");
        setTimeout(() => setToast(""), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-[var(--foreground-muted)]">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Admin Hub</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Customize your app — branding, navigation, room types, AI behavior, email templates, and more.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 neo-panel-inset p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              tab === t.id
                ? "neo-btn-primary font-semibold"
                : "text-[var(--foreground-muted)] hover:bg-white/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 neo-card px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Tab content */}
      <div className="neo-card p-6">
        {tab === "company" && <CompanyTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "navigation" && <NavigationTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "rooms" && <RoomTypesTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "ai" && <AiIntelligenceTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "email" && <EmailTemplatesTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "integrations" && <IntegrationsTab config={config} saving={saving} onSave={saveConfig} />}
        {tab === "health" && <SystemHealthTab />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 1: Company Profile
// ════════════════════════════════════════════════════════════════════════

function CompanyTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [name, setName] = useState(config.companyName);
  const [email, setEmail] = useState(config.companyEmail ?? "");
  const [phone, setPhone] = useState(config.companyPhone ?? "");
  const [address, setAddress] = useState(config.companyAddress ?? "");
  const [logo, setLogo] = useState(config.logoUrl ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Company Profile</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          This information appears in emails, print headers, and the AI system prompt.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Company Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="info@company.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="(514) 555-0123" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Logo URL</label>
          <input value={logo} onChange={(e) => setLogo(e.target.value)} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="/logo.svg or https://..." />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="neo-input w-full px-4 py-2.5 text-sm" placeholder="Company address for print headers" />
        </div>
      </div>

      {/* Preview */}
      <div className="neo-panel-inset p-4 rounded-lg">
        <h3 className="text-xs font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Email Signature Preview</h3>
        <div className="text-sm text-[var(--foreground)]">
          <p>Thank you,</p>
          <p className="font-semibold">{name || "Company Name"}</p>
          {phone && <p className="text-[var(--foreground-muted)]">{phone}</p>}
          {email && <p className="text-[var(--foreground-muted)]">{email}</p>}
          {address && <p className="text-[var(--foreground-muted)] whitespace-pre-line">{address}</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({
            companyName: name,
            companyEmail: email || null,
            companyPhone: phone || null,
            companyAddress: address || null,
            logoUrl: logo || null,
          })}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Company Profile"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 2: Navigation
// ════════════════════════════════════════════════════════════════════════

function NavigationTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [items, setItems] = useState<MenuItem[]>(() =>
    [...config.menuConfig].sort((a, b) => a.order - b.order)
  );

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next.map((item, i) => ({ ...item, order: i })));
  }

  function toggleVisible(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, visible: !item.visible } : item))
    );
  }

  function updateLabel(index: number, label: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label } : item))
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Navigation Menu</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Reorder, rename, or hide menu items. Hidden items remain accessible via URL.
        </p>
      </div>

      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
              item.visible ? "neo-panel-inset" : "opacity-50 bg-[var(--bg-light)]/30"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveItem(i, -1)} className="text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] leading-none" aria-label="Move up">&#9650;</button>
              <button onClick={() => moveItem(i, 1)} className="text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] leading-none" aria-label="Move down">&#9660;</button>
            </div>

            <span className="text-xs text-[var(--foreground-muted)] font-mono w-28 truncate">{item.href}</span>

            <input
              value={item.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              className="neo-input flex-1 px-3 py-1.5 text-sm"
            />

            <label className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={item.visible}
                onChange={() => toggleVisible(i)}
                className="rounded"
              />
              Visible
            </label>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({ menuConfig: items } as Partial<AppConfigData>)}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Navigation"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 3: Room Types
// ════════════════════════════════════════════════════════════════════════

const BUILT_IN_ROOMS: RoomType[] = [
  { value: "kitchen", label: "Kitchen", icon: "🍳", desc: "Cabinets, countertops, islands", builtIn: true },
  { value: "vanity", label: "Vanity / Bathroom", icon: "🚿", desc: "Vanities, medicine cabinets", builtIn: true },
  { value: "closet", label: "Closet / Storage", icon: "🗄", desc: "Walk-in, reach-in, pantry", builtIn: true },
  { value: "commercial", label: "Commercial / Office", icon: "🏢", desc: "Reception, built-ins", builtIn: true },
  { value: "laundry", label: "Laundry Room", icon: "🧺", desc: "Laundry cabinetry", builtIn: true },
  { value: "entertainment", label: "Entertainment Center", icon: "📺", desc: "Wall units, media", builtIn: true },
  { value: "custom", label: "Custom Piece", icon: "🔨", desc: "Shelves, furniture, one-offs", builtIn: true },
];

function RoomTypesTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [customRooms, setCustomRooms] = useState<RoomType[]>(config.customRoomTypes);
  const [processDefaults, setProcessDefaults] = useState<Record<string, string>>(config.processDefaults);
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [newRoom, setNewRoom] = useState({ value: "", label: "", icon: "", desc: "" });

  useEffect(() => {
    fetch("/api/process-templates").then((r) => r.ok ? r.json() : []).then((d) => {
      setTemplates(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []);

  function addCustomRoom() {
    if (!newRoom.value.trim() || !newRoom.label.trim()) return;
    const slug = newRoom.value.trim().toLowerCase().replace(/\s+/g, "_");
    if (BUILT_IN_ROOMS.some((r) => r.value === slug) || customRooms.some((r) => r.value === slug)) return;
    setCustomRooms((prev) => [...prev, { ...newRoom, value: slug }]);
    setNewRoom({ value: "", label: "", icon: "", desc: "" });
  }

  function removeCustomRoom(value: string) {
    setCustomRooms((prev) => prev.filter((r) => r.value !== value));
  }

  const allRooms = [...BUILT_IN_ROOMS, ...customRooms];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Room Types</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Manage built-in room types and add custom ones. Assign default process templates per room type.
        </p>
      </div>

      {/* Existing rooms */}
      <div className="space-y-2">
        {allRooms.map((room) => (
          <div key={room.value} className="neo-panel-inset flex items-center gap-3 px-4 py-3 rounded-lg">
            <span className="text-xl w-8 text-center">{room.icon || "📦"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--foreground)]">{room.label}</div>
              <div className="text-[10px] text-[var(--foreground-muted)]">{room.desc}</div>
            </div>
            <select
              value={processDefaults[room.value] ?? ""}
              onChange={(e) => setProcessDefaults((prev) => ({ ...prev, [room.value]: e.target.value }))}
              className="neo-select px-3 py-1.5 text-xs w-40"
            >
              <option value="">No default process</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {room.builtIn ? (
              <span className="text-[10px] text-[var(--foreground-muted)] px-2">Built-in</span>
            ) : (
              <button onClick={() => removeCustomRoom(room.value)} className="text-xs text-red-500 hover:text-red-700 px-2">Remove</button>
            )}
          </div>
        ))}
      </div>

      {/* Add custom room */}
      <div className="neo-panel-inset p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Add Custom Room Type</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <input value={newRoom.value} onChange={(e) => setNewRoom((n) => ({ ...n, value: e.target.value }))} placeholder="slug (e.g. garage)" className="neo-input px-3 py-2 text-sm" />
          <input value={newRoom.label} onChange={(e) => setNewRoom((n) => ({ ...n, label: e.target.value }))} placeholder="Label (e.g. Garage)" className="neo-input px-3 py-2 text-sm" />
          <input value={newRoom.icon} onChange={(e) => setNewRoom((n) => ({ ...n, icon: e.target.value }))} placeholder="Icon (emoji)" className="neo-input px-3 py-2 text-sm" />
          <input value={newRoom.desc} onChange={(e) => setNewRoom((n) => ({ ...n, desc: e.target.value }))} placeholder="Description" className="neo-input px-3 py-2 text-sm" />
        </div>
        <button onClick={addCustomRoom} className="neo-btn px-4 py-2 text-sm mt-3">Add Room Type</button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({ customRoomTypes: customRooms, processDefaults } as Partial<AppConfigData>)}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Room Types"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 4: AI Intelligence
// ════════════════════════════════════════════════════════════════════════

function AiIntelligenceTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [aliases, setAliases] = useState<[string, string][]>(() =>
    Object.entries(config.materialAliases)
  );
  const [newAlias, setNewAlias] = useState({ key: "", value: "" });
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");

  function addAlias() {
    const key = newAlias.key.trim().toLowerCase();
    const value = newAlias.value.trim();
    if (!key || !value) return;
    if (aliases.some(([k]) => k === key)) return;
    setAliases((prev) => [...prev, [key, value]]);
    setNewAlias({ key: "", value: "" });
  }

  function removeAlias(key: string) {
    setAliases((prev) => prev.filter(([k]) => k !== key));
  }

  function updateAlias(index: number, field: 0 | 1, val: string) {
    setAliases((prev) => prev.map((entry, i) => {
      if (i !== index) return entry;
      const copy: [string, string] = [...entry];
      copy[field] = val;
      return copy;
    }));
  }

  function testResolve() {
    const lower = testInput.toLowerCase().trim();
    const match = aliases.find(([k]) => lower.includes(k));
    if (match) {
      setTestResult(`"${testInput}" resolves to material code: ${match[1]}`);
    } else {
      setTestResult(`No alias match for "${testInput}". The AI will interpret freely.`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">AI Intelligence</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Teach the AI your shop vocabulary. Material aliases map informal names to inventory codes.
        </p>
      </div>

      {/* Alias table */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_1fr_60px] gap-2 px-4 py-2 text-xs font-medium text-[var(--foreground-muted)]">
          <span>Alias (what you say)</span>
          <span>Material Code (what it maps to)</span>
          <span></span>
        </div>
        {aliases.map(([key, val], i) => (
          <div key={`${key}-${i}`} className="grid grid-cols-[1fr_1fr_60px] gap-2 items-center">
            <input value={key} onChange={(e) => updateAlias(i, 0, e.target.value)} className="neo-input px-3 py-1.5 text-sm" />
            <input value={val} onChange={(e) => updateAlias(i, 1, e.target.value)} className="neo-input px-3 py-1.5 text-sm" />
            <button onClick={() => removeAlias(key)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>
        ))}
      </div>

      {/* Add new alias */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">New Alias</label>
          <input value={newAlias.key} onChange={(e) => setNewAlias((n) => ({ ...n, key: e.target.value }))} placeholder='e.g. "mel noire"' className="neo-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Maps To</label>
          <input value={newAlias.value} onChange={(e) => setNewAlias((n) => ({ ...n, value: e.target.value }))} placeholder="e.g. MEL-BLK-5/8-4x8" className="neo-input w-full px-3 py-2 text-sm" />
        </div>
        <button onClick={addAlias} className="neo-btn px-4 py-2 text-sm">Add</button>
      </div>

      {/* Test section */}
      <div className="neo-panel-inset p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Test Alias Resolution</h3>
        <div className="flex gap-2">
          <input
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testResolve()}
            placeholder='Try: "add 2 white melamines"'
            className="neo-input flex-1 px-3 py-2 text-sm"
          />
          <button onClick={testResolve} className="neo-btn px-4 py-2 text-sm">Test</button>
        </div>
        {testResult && (
          <p className="text-sm text-[var(--foreground)] mt-2 p-2 bg-white/50 rounded">{testResult}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            const map: Record<string, string> = {};
            for (const [k, v] of aliases) {
              if (k.trim() && v.trim()) map[k.trim().toLowerCase()] = v.trim();
            }
            onSave({ materialAliases: map } as Partial<AppConfigData>);
          }}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Aliases"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 5: Email Templates
// ════════════════════════════════════════════════════════════════════════

const EMAIL_VARIABLES = [
  { var: "{companyName}", desc: "Your company name" },
  { var: "{supplierName}", desc: "Supplier name" },
  { var: "{clientName}", desc: "Client full name" },
  { var: "{projectRef}", desc: "Job # or client name" },
  { var: "{materialList}", desc: "Formatted list of materials/quantities" },
  { var: "{deliveryDate}", desc: "Requested delivery date" },
  { var: "{notes}", desc: "Additional notes" },
  { var: "{body}", desc: "Main email body (for followups)" },
];

function EmailTemplatesTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [templates, setTemplates] = useState<EmailTemplates>(config.emailTemplates);
  const [activeTemplate, setActiveTemplate] = useState<keyof EmailTemplates>("supplierOrder");

  const templateLabels: Record<keyof EmailTemplates, string> = {
    supplierOrder: "Supplier Order",
    supplierReserve: "Supplier Reservation",
    clientFollowup: "Client Follow-up",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Email Templates</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Customize the email templates used for supplier orders, reservations, and client follow-ups.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {(Object.keys(templateLabels) as (keyof EmailTemplates)[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTemplate(key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeTemplate === key
                ? "neo-btn-primary font-semibold"
                : "neo-btn"
            }`}
          >
            {templateLabels[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            {templateLabels[activeTemplate]} Template
          </label>
          <textarea
            value={templates[activeTemplate]}
            onChange={(e) => setTemplates((t) => ({ ...t, [activeTemplate]: e.target.value }))}
            rows={14}
            className="neo-input w-full px-4 py-3 text-sm font-mono leading-relaxed"
          />
        </div>

        <div className="neo-panel-inset p-4 rounded-lg h-fit">
          <h3 className="text-xs font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">
            Available Variables
          </h3>
          <div className="space-y-2">
            {EMAIL_VARIABLES.map((v) => (
              <div key={v.var}>
                <code className="text-xs font-mono text-[var(--accent)]">{v.var}</code>
                <p className="text-[10px] text-[var(--foreground-muted)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="neo-panel-inset p-4 rounded-lg">
        <h3 className="text-xs font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Preview</h3>
        <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans leading-relaxed">
          {templates[activeTemplate]
            .replace("{companyName}", config.companyName)
            .replace("{supplierName}", "Richelieu")
            .replace("{clientName}", "Jean Dupont")
            .replace("{projectRef}", "MC-6199")
            .replace("{materialList}", "- 10x White Melamine 5/8\" 4x8 (SKU: MEL-WHT)\n  Material code: MEL-WHT-5/8-4x8")
            .replace("{deliveryDate}", new Date(Date.now() + 14 * 86400000).toLocaleDateString())
            .replace("{notes}", "")
            .replace("{body}", "Your project is progressing well. We expect delivery by next Friday.")}
        </pre>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({ emailTemplates: templates } as Partial<AppConfigData>)}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Email Templates"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 6: Integrations
// ════════════════════════════════════════════════════════════════════════

type MondayBoardRef = { id: string; name?: string };
type IonosHealthResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  details?: string;
  status?: number;
  endpoint?: string;
  zoneCount?: number | null;
  configured?: {
    publicKey?: boolean | string;
    secretKey?: boolean | string;
  };
};

function IntegrationsTab({ config, saving, onSave }: {
  config: AppConfigData;
  saving: boolean;
  onSave: (p: Partial<AppConfigData>) => Promise<void>;
}) {
  const [mondayKey, setMondayKey] = useState((config.integrations.mondayApiKey as string) ?? "");
  const [savedBoards, setSavedBoards] = useState<MondayBoardRef[]>(() => {
    const boards = config.integrations.mondayBoards as MondayBoardRef[] | undefined;
    if (Array.isArray(boards) && boards.length > 0) return boards;
    const legacy = config.integrations.mondayBoardId as string | undefined;
    return legacy ? [{ id: legacy }] : [];
  });
  const [newBoardId, setNewBoardId] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testBoards, setTestBoards] = useState<{ id: string; name: string }[]>([]);
  const [testError, setTestError] = useState("");
  const [sageClientId, setSageClientId] = useState((config.integrations.sageClientId as string) ?? "");
  const [sageClientSecret, setSageClientSecret] = useState((config.integrations.sageClientSecret as string) ?? "");
  const [showSageSecret, setShowSageSecret] = useState(false);
  const [ionosStatus, setIonosStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [ionosHealth, setIonosHealth] = useState<IonosHealthResponse | null>(null);

  async function testIonosConnection() {
    setIonosStatus("loading");
    setIonosHealth(null);
    try {
      const res = await fetch("/api/integrations/ionos/health", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as IonosHealthResponse;
      setIonosHealth(data);
      setIonosStatus(res.ok && data.ok ? "ok" : "error");
    } catch {
      setIonosHealth({
        ok: false,
        error: "IONOS test request failed.",
        details: "Check your local server and internet connection.",
      });
      setIonosStatus("error");
    }
  }

  function addSavedBoard(id: string, name?: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    if (savedBoards.some((b) => b.id === trimmed)) return;
    setSavedBoards((prev) => [...prev, { id: trimmed, name: name?.trim() || undefined }]);
  }

  function removeSavedBoard(id: string) {
    setSavedBoards((prev) => prev.filter((b) => b.id !== id));
  }

  async function testMondayConnection() {
    setTestStatus("loading");
    setTestError("");
    setTestBoards([]);
    try {
      const res = await fetch("/api/integrations/monday/boards");
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error ?? "Connection failed");
        setTestStatus("error");
        return;
      }
      setTestBoards(data.boards ?? []);
      setTestStatus("ok");
    } catch {
      setTestError("Request failed");
      setTestStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Integrations</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Connect external services. API keys are stored in the app database (Admin only).
        </p>
      </div>

      {/* Monday.com */}
      <div className="neo-panel-inset p-5 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Monday.com</h3>
            <p className="text-xs text-[var(--foreground-muted)]">Import projects from Monday boards and let the AI create draft projects when new items appear.</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            mondayKey ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {mondayKey ? "Configured" : "Not configured"}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={mondayKey}
              onChange={(e) => setMondayKey(e.target.value)}
              placeholder="Paste your Monday.com API token"
              className="neo-input flex-1 px-3 py-2 text-sm font-mono"
            />
            <button onClick={() => setShowKey(!showKey)} className="neo-btn px-3 py-2 text-xs">
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
            Get your key: Monday.com → bottom-left profile → Admin → API → copy token. Save below, then use &quot;Test connection&quot; to list boards.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Saved boards (use multiple)</label>
          <p className="text-[10px] text-[var(--foreground-muted)] mb-2">
            The AI can list items and create projects from any of these. First board is the default when you don’t specify one.
          </p>
          <ul className="space-y-1.5 mb-2">
            {savedBoards.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[var(--foreground)]">{b.id}</span>
                {b.name && <span className="text-[var(--foreground-muted)] truncate">— {b.name}</span>}
                <button type="button" onClick={() => removeSavedBoard(b.id)} className="text-xs text-red-500 hover:text-red-700 ml-auto">Remove</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={newBoardId}
              onChange={(e) => setNewBoardId(e.target.value)}
              placeholder="Board ID"
              className="neo-input w-32 px-3 py-1.5 text-sm font-mono"
            />
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Label (optional)"
              className="neo-input flex-1 min-w-[100px] px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={() => { addSavedBoard(newBoardId, newBoardName); setNewBoardId(""); setNewBoardName(""); }} className="neo-btn px-3 py-1.5 text-xs">
              Add board
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={testMondayConnection}
            disabled={testStatus === "loading"}
            className="neo-btn px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {testStatus === "loading" ? "Testing…" : "Test connection"}
          </button>
          {testStatus === "ok" && (
            <span className="text-xs text-green-600 font-medium">Connected. Boards listed below.</span>
          )}
          {testStatus === "error" && (
            <span className="text-xs text-red-600">{testError}</span>
          )}
        </div>

        {testBoards.length > 0 && (
          <div className="neo-panel-inset p-3 rounded-lg">
            <p className="text-[10px] font-medium text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Your Monday boards — click Add to save one</p>
            <ul className="space-y-1 max-h-40 overflow-auto">
              {testBoards.map((b) => (
                <li key={b.id} className="text-xs flex items-center justify-between gap-2">
                  <span className="font-mono text-[var(--foreground)]">{b.id}</span>
                  <span className="text-[var(--foreground-muted)] truncate flex-1">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => addSavedBoard(b.id, b.name)}
                    className="neo-btn px-2 py-0.5 text-[10px] shrink-0"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sage Business Cloud Accounting */}
      <div className="neo-panel-inset p-5 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Sage Business Cloud Accounting</h3>
            <p className="text-xs text-[var(--foreground-muted)]">Connect your Sage account (Canada). Save Client ID and Secret below, then click Connect to sign in with Sage.</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            config.integrations.sageAccessToken || config.integrations.sageRefreshToken
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {config.integrations.sageAccessToken || config.integrations.sageRefreshToken ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Client ID</label>
            <input
              type={showSageSecret ? "text" : "password"}
              value={sageClientId}
              onChange={(e) => setSageClientId(e.target.value)}
              placeholder="From your Sage app (A-P Connection)"
              className="neo-input w-full px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Client Secret</label>
            <div className="flex gap-2">
              <input
                type={showSageSecret ? "text" : "password"}
                value={sageClientSecret}
                onChange={(e) => setSageClientSecret(e.target.value)}
                placeholder="From your Sage app"
                className="neo-input flex-1 px-3 py-2 text-sm font-mono"
              />
              <button type="button" onClick={() => setShowSageSecret(!showSageSecret)} className="neo-btn px-3 py-2 text-xs">
                {showSageSecret ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[var(--foreground-muted)]">
          Callback URL in Sage app must match exactly: <code className="font-mono bg-white/50 px-1 rounded">http://localhost:3000/api/integrations/sage/callback</code> (no trailing slash). This app uses NA endpoints (accounting.na.sageone.com). If you need the global Sage auth instead, set <code className="font-mono bg-white/50 px-1 rounded">SAGE_USE_GLOBAL_AUTH=true</code> in <code className="font-mono">.env.local</code> and restart.
        </p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>If you see &quot;Erreur d&apos;autorisation&quot; or console errors on Sage&apos;s page:</strong> those come from Sage (their error page has broken scripts). Sage is rejecting the OAuth request — often due to callback URL mismatch, app region, or scope. Our integration is ready; double-check the callback URL in your Sage app and that the app is for the same region (NA/Canada). You can also contact Sage support with your app name (A-P Connection) and that the NA OAuth error page fails to load.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/integrations/sage/connect"
            className="neo-btn-primary px-4 py-2 text-xs font-medium"
          >
            Connect to Sage
          </a>
          {(config.integrations.sageAccessToken || config.integrations.sageRefreshToken) && (
            <button
              type="button"
              onClick={() => onSave({
                integrations: {
                  ...config.integrations,
                  sageAccessToken: undefined,
                  sageRefreshToken: undefined,
                  sageTokenExpiresAt: undefined,
                },
              })}
              className="neo-btn px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* IONOS DNS */}
      <div className="neo-panel-inset p-5 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">IONOS DNS</h3>
            <p className="text-xs text-[var(--foreground-muted)]">
              Validate your IONOS public/secret key pair from environment variables and verify DNS API access.
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              ionosStatus === "ok"
                ? "bg-green-100 text-green-700"
                : ionosStatus === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {ionosStatus === "ok" ? "Connected" : ionosStatus === "error" ? "Issue detected" : "Not tested"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={testIonosConnection}
            disabled={ionosStatus === "loading"}
            className="neo-btn px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {ionosStatus === "loading" ? "Testing…" : "Test IONOS DNS"}
          </button>
          <p className="text-[10px] text-[var(--foreground-muted)]">
            Reads server-side env vars: <code className="font-mono">IONOS_PUBLIC_API_KEY</code> and <code className="font-mono">IONOS_SECRET_API_KEY</code>.
          </p>
        </div>

        {ionosHealth && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              ionosHealth.ok
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <p className="font-medium">
              {ionosHealth.ok ? ionosHealth.message ?? "IONOS connection is healthy." : ionosHealth.error ?? "IONOS check failed."}
            </p>
            {(ionosHealth.details || ionosHealth.status) && (
              <p className="mt-1 opacity-90">
                {ionosHealth.status ? `HTTP ${ionosHealth.status}` : ""}{ionosHealth.details ? ` — ${ionosHealth.details}` : ""}
              </p>
            )}
            <div className="mt-2 grid gap-1 text-[11px]">
              {ionosHealth.endpoint && (
                <p>
                  <span className="font-medium">Endpoint:</span> <code className="font-mono">{ionosHealth.endpoint}</code>
                </p>
              )}
              {typeof ionosHealth.zoneCount === "number" && (
                <p>
                  <span className="font-medium">Zones found:</span> {ionosHealth.zoneCount}
                </p>
              )}
              {ionosHealth.configured && (
                <p>
                  <span className="font-medium">Configured keys:</span>{" "}
                  public={String(ionosHealth.configured.publicKey ?? false)}, secret={String(ionosHealth.configured.secretKey ?? false)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Excel Import (placeholder) */}
      <div className="neo-panel-inset p-5 rounded-lg opacity-60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Excel Import/Export</h3>
            <p className="text-xs text-[var(--foreground-muted)]">Bulk data import from spreadsheets</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Coming Soon</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({
            integrations: {
              ...config.integrations,
              mondayApiKey: mondayKey || undefined,
              mondayBoards: savedBoards.length > 0 ? savedBoards : undefined,
              mondayBoardId: savedBoards[0]?.id,
              sageClientId: sageClientId.trim() || undefined,
              sageClientSecret: sageClientSecret || undefined,
            },
          })}
          disabled={saving}
          className="neo-btn-primary px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Integrations"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 7: System Health
// ════════════════════════════════════════════════════════════════════════

function SystemHealthTab() {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState<string | null>(null);
  const [showArchitecture, setShowArchitecture] = useState(false);

  useEffect(() => {
    fetch("/api/admin/errors?limit=100")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setErrors(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  async function generateDiagnostic(id: string) {
    setDiagLoading(id);
    try {
      const res = await fetch(`/api/admin/errors/${id}/diagnose`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setErrors((prev) =>
          prev.map((e) => (e.id === id ? { ...e, aiDiagnosticPrompt: data.diagnosticPrompt } : e))
        );
      }
    } finally {
      setDiagLoading(null);
    }
  }

  async function markResolved(id: string) {
    setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, resolved: true } : e)));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const unresolvedCount = errors.filter((e) => !e.resolved).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">System Health</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Error log, AI diagnostics, and application architecture reference.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="neo-panel-inset p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">{errors.length}</div>
          <div className="text-xs text-[var(--foreground-muted)]">Total Errors</div>
        </div>
        <div className="neo-panel-inset p-4 rounded-lg text-center">
          <div className={`text-2xl font-bold ${unresolvedCount > 0 ? "text-red-500" : "text-green-600"}`}>
            {unresolvedCount}
          </div>
          <div className="text-xs text-[var(--foreground-muted)]">Unresolved</div>
        </div>
        <div className="neo-panel-inset p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{errors.length - unresolvedCount}</div>
          <div className="text-xs text-[var(--foreground-muted)]">Resolved</div>
        </div>
      </div>

      {/* Error log */}
      {loading ? (
        <p className="text-sm text-[var(--foreground-muted)]">Loading errors...</p>
      ) : errors.length === 0 ? (
        <div className="neo-panel-inset p-8 rounded-lg text-center">
          <p className="text-sm text-[var(--foreground-muted)]">No errors logged yet. The system is healthy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map((err) => (
            <div key={err.id} className={`neo-panel-inset rounded-lg overflow-hidden ${err.resolved ? "opacity-50" : ""}`}>
              <button
                onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/30 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  err.severity === "error" ? "bg-red-500" : "bg-yellow-500"
                }`} />
                <span className="text-xs font-mono text-[var(--foreground-muted)] w-16 shrink-0">{err.source}</span>
                <span className="text-sm text-[var(--foreground)] flex-1 truncate">{err.message}</span>
                <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                  {new Date(err.createdAt).toLocaleString()}
                </span>
                <span className="text-xs">{expandedId === err.id ? "▲" : "▼"}</span>
              </button>

              {expandedId === err.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-[var(--shadow-dark)]/10">
                  {err.route && (
                    <div className="text-xs mt-3">
                      <span className="text-[var(--foreground-muted)]">Route: </span>
                      <span className="font-mono text-[var(--foreground)]">{err.route}</span>
                    </div>
                  )}

                  {err.stack && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--foreground-muted)] mb-1">Stack Trace</h4>
                      <pre className="text-[10px] font-mono text-[var(--foreground)] bg-white/50 p-3 rounded overflow-x-auto max-h-32">{err.stack}</pre>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!err.aiDiagnosticPrompt ? (
                      <button
                        onClick={() => generateDiagnostic(err.id)}
                        disabled={diagLoading === err.id}
                        className="neo-btn-primary px-4 py-2 text-xs font-medium disabled:opacity-50"
                      >
                        {diagLoading === err.id ? "Generating..." : "Generate AI Diagnostic"}
                      </button>
                    ) : (
                      <button
                        onClick={() => copyToClipboard(err.aiDiagnosticPrompt!)}
                        className="neo-btn px-4 py-2 text-xs font-medium"
                      >
                        Copy Diagnostic Prompt
                      </button>
                    )}
                    {!err.resolved && (
                      <button onClick={() => markResolved(err.id)} className="neo-btn px-4 py-2 text-xs">
                        Mark Resolved
                      </button>
                    )}
                  </div>

                  {err.aiDiagnosticPrompt && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--foreground-muted)] mb-1">AI Diagnostic Prompt</h4>
                      <pre className="text-[10px] font-mono text-[var(--foreground)] bg-white/50 p-3 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">{err.aiDiagnosticPrompt}</pre>
                      <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                        Copy this prompt and paste it into Cursor or another AI tool for diagnosis.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Architecture Reference (collapsible) */}
      <div className="neo-panel-inset rounded-lg overflow-hidden">
        <button
          onClick={() => setShowArchitecture(!showArchitecture)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/30 transition-colors"
        >
          <span className="text-sm font-semibold text-[var(--foreground)]">Developer Reference — App Architecture</span>
          <span className="text-xs">{showArchitecture ? "▲" : "▼"}</span>
        </button>
        {showArchitecture && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--shadow-dark)]/10 mt-0 pt-4">
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div className="bg-white/30 p-3 rounded-lg">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Frontend</h3>
                <ul className="space-y-1 text-[var(--foreground-muted)] text-xs">
                  <li>Next.js 14 (App Router)</li>
                  <li>React client components</li>
                  <li>Neumorphic UI (Tailwind)</li>
                  <li>AI chat widget (global)</li>
                </ul>
              </div>
              <div className="bg-white/30 p-3 rounded-lg">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Backend</h3>
                <ul className="space-y-1 text-[var(--foreground-muted)] text-xs">
                  <li>Next.js API routes</li>
                  <li>Prisma ORM + SQLite</li>
                  <li>Observability engine</li>
                  <li>Recalculation pipeline</li>
                </ul>
              </div>
              <div className="bg-white/30 p-3 rounded-lg">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Intelligence</h3>
                <ul className="space-y-1 text-[var(--foreground-muted)] text-xs">
                  <li>OpenAI GPT-4o</li>
                  <li>Function calling (tools)</li>
                  <li>Note intent parsing</li>
                  <li>Action queue (approve/reject)</li>
                </ul>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="bg-white/30 p-3 rounded-lg">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Key Entities</h3>
                <ul className="space-y-1.5 text-[var(--foreground-muted)] text-xs">
                  <li><strong>Project</strong> — Client(s), Rooms, TaskItems, Orders, CostLines</li>
                  <li><strong>ProjectItem</strong> — Room/deliverable with process template</li>
                  <li><strong>Supplier</strong> — CatalogItems linking materials</li>
                  <li><strong>InventoryItem</strong> — onHand, thresholds, movements</li>
                  <li><strong>Order</strong> — Lines, receiving, deviations</li>
                  <li><strong>Deviation</strong> — Risk alerts from observability</li>
                </ul>
              </div>
              <div className="bg-white/30 p-3 rounded-lg">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Data Flow</h3>
                <ul className="space-y-1.5 text-[var(--foreground-muted)] text-xs">
                  <li>CutList → MaterialRequirements (computed)</li>
                  <li>Requirements vs Inventory → Shortage detection</li>
                  <li>Shortages → Order drafts → Supplier emails</li>
                  <li>Receiving → StockMovements → Deviation log</li>
                  <li>Observability → Financial + Material + Order risk</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-12 text-center text-[var(--foreground-muted)]">Loading...</div>}>
      <AdminPageContent />
    </Suspense>
  );
}
