"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { computeReadinessCheck } from "@/lib/readiness";
import { getStageView, type StageView } from "@/lib/projectStage";

type ProcessTemplate = { id: string; name: string };

type ProjectLike = {
  id: string;
  isDraft: boolean;
  jobNumber?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientAddress?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  projectItems?: unknown[] | null;
  // Lifecycle signals — let the panel render stage-aware copy without the
  // caller needing to branch. All optional; `getStageView` falls back to
  // legacy `isDraft` when these are absent.
  stage?: string | null;
  depositReceivedAt?: string | Date | null;
  isDone?: boolean;
  archivedAt?: string | Date | null;
  lostReason?: string | null;
};

/**
 * Copy dictionary per stage view. Kept at the top so the label polish is
 * obvious from a single glance instead of scattered ternaries in JSX.
 */
const INTAKE_COPY: Record<
  "quote" | "draft_project" | "fallback",
  {
    title: string;
    subtitle: string;
    referenceLabel: string;
    referencePlaceholder: string;
    missingLabel: string;
    saveLabel: string;
    savingLabel: string;
    savedToast: string;
    scopeLabel: string;
  }
> = {
  quote: {
    title: "Quote intake",
    subtitle:
      "Client name + a rough scope is enough to start. You can build the price on the next tab.",
    referenceLabel: "Reference (optional)",
    referencePlaceholder: "Internal note, e.g. MC-Q-0412",
    missingLabel: "Still needed before sending this quote",
    saveLabel: "Save quote basics",
    savingLabel: "Saving…",
    savedToast: "Quote info saved",
    scopeLabel: "Scope notes (paste messy info from Monday, emails, Sage)",
  },
  draft_project: {
    title: "Invoice intake",
    subtitle:
      "Invoice is out — wrap up the missing info so planning can take over once the deposit lands.",
    referenceLabel: "Invoice / job #",
    referencePlaceholder: "MC-1234",
    missingLabel: "Still needed to hand off to planning",
    saveLabel: "Save invoice basics",
    savingLabel: "Saving…",
    savedToast: "Invoice info saved",
    scopeLabel: "Notes / scope (paste messy info from Monday, emails, Sage)",
  },
  fallback: {
    title: "Draft intake",
    subtitle:
      "Fill the basics, then use AI to suggest rooms (deliverables) from messy notes.",
    referenceLabel: "Invoice / job #",
    referencePlaceholder: "MC-1234",
    missingLabel: "Missing for publish",
    saveLabel: "Save basics",
    savingLabel: "Saving…",
    savedToast: "Draft info saved",
    scopeLabel: "Notes / scope (paste messy info from Monday, emails, texts)",
  },
};

function copyForStage(view: StageView): (typeof INTAKE_COPY)[keyof typeof INTAKE_COPY] {
  if (view === "quote") return INTAKE_COPY.quote;
  if (view === "draft_project") return INTAKE_COPY.draft_project;
  return INTAKE_COPY.fallback;
}

// Suggestions are intentionally rooms-only — process steps come from the
// curated `ProcessTemplate` that the server maps by room type.
type SuggestedRoom = {
  label: string;
  type: string;
  count?: number;
};

export function DraftIntakePanel({
  project,
  processTemplates,
  onApplied,
}: {
  project: ProjectLike;
  processTemplates: ProcessTemplate[];
  onApplied: () => Promise<void> | void;
}) {
  const [jobNumber, setJobNumber] = useState(project.jobNumber ?? "");
  const [clientFirst, setClientFirst] = useState(project.clientFirstName ?? "");
  const [clientLast, setClientLast] = useState(project.clientLastName ?? "");
  const [address, setAddress] = useState(project.clientAddress ?? "");
  const [targetDate, setTargetDate] = useState(project.targetDate ?? "");
  const [saving, setSaving] = useState(false);

  // Derive the stage view once per render. Falls back gracefully when the
  // caller hasn't threaded through the new lifecycle fields yet.
  const stageView = useMemo(() => getStageView(project), [project]);
  const copy = copyForStage(stageView);

  const readiness = useMemo(() => {
    return computeReadinessCheck({
      jobNumber,
      clientId: null,
      clientFirstName: clientFirst,
      clientLastName: clientLast,
      targetDate: targetDate ? new Date(targetDate) : null,
      projectItemCount: project.projectItems?.length ?? 0,
    });
  }, [jobNumber, clientFirst, clientLast, targetDate, project.projectItems?.length]);

  const [scopeText, setScopeText] = useState(project.notes ?? "");
  const [parsing, setParsing] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedRoom[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // Process template overrides are optional here — the server will pick a
  // sensible default for each room type (vanity → Vanity, side_unit → Side
  // Unit, kitchen → Kitchen, else → Kitchen) unless the user overrides it.
  const [selectedProcessByIdx, setSelectedProcessByIdx] = useState<Record<number, string>>({});
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  async function saveCore() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobNumber: jobNumber.trim() || null,
          clientFirstName: clientFirst.trim() || null,
          clientLastName: clientLast.trim() || null,
          clientAddress: address.trim() || null,
          targetDate: targetDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to save");
        return;
      }
      toast.success(copy.savedToast);
      await onApplied();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function suggestRooms() {
    setParsing(true);
    setSuggestError(null);
    setSuggested([]);
    try {
      const res = await fetch("/api/ai/parse-project-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scopeText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestError(data?.error ?? "AI parse failed");
        return;
      }
      setSuggested(Array.isArray(data.rooms) ? data.rooms : []);
      if (!Array.isArray(data.rooms) || data.rooms.length === 0) {
        setSuggestError("No rooms suggested. Try adding more detail.");
      }
    } catch {
      setSuggestError("Request failed");
    } finally {
      setParsing(false);
    }
  }

  async function addRoom(idx: number) {
    const room = suggested[idx];
    if (!room) return;
    const processOverride = (selectedProcessByIdx[idx] ?? "").trim();
    const count = Math.min(Math.max(room.count ?? 1, 1), 20);
    setAddingIdx(idx);
    try {
      // Create N copies when the suggestion implies repetition
      // (e.g. "two vanities" → count 2). Each room gets its own process
      // checklist seeded server-side.
      for (let i = 0; i < count; i++) {
        const suffix = count > 1 ? ` #${i + 1}` : "";
        const res = await fetch(`/api/projects/${project.id}/project-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: room.type || "custom",
            label: room.label + suffix,
            // If the user picked an explicit template, pass it. Otherwise we
            // rely on the server's room-type → template resolver.
            processTemplateId: processOverride || undefined,
            useDefaultProcess: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to add room");
          return;
        }
      }
      toast.success(count > 1 ? `${count} rooms added` : "Room added");
      await onApplied();
    } catch {
      toast.error("Failed to add room");
    } finally {
      setAddingIdx(null);
    }
  }

  // Show the panel for any pre-deposit stage (quote / draft_project) OR any
  // legacy `isDraft` row. Hide once a deposit has landed (stage=project) or
  // the project is done/archived/lost — those have their own surfaces.
  const isPreDeposit = stageView === "quote" || stageView === "draft_project";
  if (!isPreDeposit && !project.isDraft) return null;

  return (
    <div className="neo-card p-4 space-y-4 border-l-4 border-[var(--accent)]">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{copy.title}</h3>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">{copy.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
            {copy.referenceLabel}
          </label>
          <input
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            className="neo-input w-full px-3 py-2 text-sm font-mono"
            placeholder={copy.referencePlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Target date</label>
          <input type="date" value={targetDate ?? ""} onChange={(e) => setTargetDate(e.target.value)} className="neo-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Client first name</label>
          <input value={clientFirst} onChange={(e) => setClientFirst(e.target.value)} className="neo-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Client last name</label>
          <input value={clientLast} onChange={(e) => setClientLast(e.target.value)} className="neo-input w-full px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="neo-input w-full px-3 py-2 text-sm" placeholder="Street, City" />
        </div>
      </div>

      {!readiness.ready && (
        <div className="neo-panel-inset p-3 text-xs text-amber-800">
          {copy.missingLabel}: <span className="font-mono">{readiness.missing.join(", ")}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={saveCore}
          disabled={saving}
          className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? copy.savingLabel : copy.saveLabel}
        </button>
      </div>

      <div className="pt-2 border-t border-[var(--shadow-dark)]/15">
        <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
          {copy.scopeLabel}
        </label>
        <textarea
          value={scopeText}
          onChange={(e) => setScopeText(e.target.value)}
          className="neo-input w-full px-3 py-2 text-sm min-h-[110px]"
          placeholder="Example: Kitchen + pantry. 2 vanities, 1 medicine cabinet, floating shelf…"
        />
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={suggestRooms} disabled={parsing || !scopeText.trim()} className="neo-btn px-4 py-2 text-sm disabled:opacity-50">
            {parsing ? "Suggesting…" : "Suggest rooms"}
          </button>
          {suggestError && <span className="text-xs text-red-600 self-center">{suggestError}</span>}
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">
            Suggested rooms (review & apply)
          </div>
          {suggested.map((r, idx) => {
            const count = Math.min(Math.max(r.count ?? 1, 1), 20);
            return (
              <div key={`${idx}-${r.label}`} className="neo-panel-inset p-3 rounded-lg space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{r.label}</span>
                    {count > 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
                        ×{count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-light)] text-[var(--foreground-muted)]">
                    {(r.type || "custom").replace("_", " ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedProcessByIdx[idx] ?? ""}
                    onChange={(e) => setSelectedProcessByIdx((prev) => ({ ...prev, [idx]: e.target.value }))}
                    className="neo-select px-3 py-2 text-xs"
                    title="Override the default process (optional)"
                  >
                    <option value="">Use default for this room type</option>
                    {processTemplates.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addRoom(idx)}
                    disabled={addingIdx === idx}
                    className="neo-btn-primary px-3 py-2 text-xs disabled:opacity-50"
                  >
                    {addingIdx === idx ? "Adding…" : count > 1 ? `Add ${count} rooms` : "Add room"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

