"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Employee = { id: string; name: string; color: string | null; role: string };

type ProcessStep = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
  assignedEmployeeId: string | null;
  assignedEmployee: Employee | null;
  scheduledDate: string | null;
  estimatedMinutes: number | null;
  status: string;
  completedAt: string | null;
  notes: string | null;
  step?: { id: string; label: string; estimatedMinutes: number | null; type: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  blocked: "bg-red-100 text-red-600",
};

function fmtMinutes(min: number | null): string {
  if (!min) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CA");
}

export function ProductionTab({
  projectId,
  processTemplateId,
}: {
  projectId: string;
  processTemplateId?: string | null;
}) {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newMinutes, setNewMinutes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ProcessStep>>({});

  const fetchSteps = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/process-steps`);
      if (res.ok) setSteps(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSteps();
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [fetchSteps]);

  async function handleSeed(opts?: { replace?: boolean }) {
    const replace = opts?.replace === true;
    if (replace && steps.length > 0) {
      const ok = window.confirm(
        "Replace all production steps with steps from the current project process template? Existing step rows (assignments, dates, status) will be removed."
      );
      if (!ok) return;
    }
    setSeeding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/process-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed", ...(replace ? { replace: true } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Seeding failed");
        return;
      }
      toast.success(replace ? "Steps replaced from template" : "Steps loaded from template");
      await fetchSteps();
    } catch {
      toast.error("Failed");
    } finally {
      setSeeding(false);
    }
  }

  async function handleAddStep() {
    if (!newLabel.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/process-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          label: newLabel.trim(),
          estimatedMinutes: newMinutes ? parseInt(newMinutes, 10) : undefined,
        }),
      });
      if (!res.ok) { toast.error("Failed"); return; }
      setNewLabel(""); setNewMinutes(""); setAddingStep(false);
      toast.success("Step added");
      await fetchSteps();
    } catch {
      toast.error("Failed");
    }
  }

  async function handlePatch(stepId: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/projects/${projectId}/process-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { toast.error("Update failed"); return; }
      await fetchSteps();
    } catch {
      toast.error("Failed");
    }
  }

  async function handleDelete(stepId: string) {
    try {
      await fetch(`/api/projects/${projectId}/process-steps/${stepId}`, { method: "DELETE" });
      toast.success("Step removed");
      await fetchSteps();
    } catch {
      toast.error("Failed");
    }
  }

  function startEdit(step: ProcessStep) {
    setEditingId(step.id);
    setEditData({
      assignedEmployeeId: step.assignedEmployeeId,
      scheduledDate: step.scheduledDate ? step.scheduledDate.slice(0, 10) : null,
      estimatedMinutes: step.estimatedMinutes,
      status: step.status,
      notes: step.notes,
    });
  }

  async function saveEdit(stepId: string) {
    await handlePatch(stepId, editData);
    setEditingId(null);
    setEditData({});
  }

  const totalMinutes = steps.reduce((s, st) => s + (st.estimatedMinutes ?? 0), 0);
  const doneCount = steps.filter((s) => s.status === "done").length;

  if (loading) return <p className="text-sm text-[var(--foreground-muted)] py-4">Loading steps…</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Production Steps</h3>
          {steps.length > 0 && (
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              {doneCount}/{steps.length} done · {fmtMinutes(totalMinutes)} total
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {processTemplateId && (
            <button
              onClick={() => void handleSeed({ replace: steps.length > 0 })}
              disabled={seeding}
              className="neo-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {seeding ? "Loading…" : steps.length === 0 ? "Load from template" : "Reload from template"}
            </button>
          )}
          <button
            onClick={() => setAddingStep(true)}
            className="neo-btn px-3 py-1.5 text-xs"
          >
            + Add step
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="h-2 bg-[var(--bg-light)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Steps list */}
      {steps.length === 0 && !addingStep ? (
        <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">
          No production steps yet.{" "}
          {processTemplateId ? 'Use "Load from template" or add steps manually.' : "Add steps manually."}
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const isEditing = editingId === step.id;
            const emp = employees.find((e) => e.id === step.assignedEmployeeId);

            return (
              <div
                key={step.id}
                className={`neo-card p-4 transition-all ${
                  step.status === "done" ? "opacity-60" : ""
                }`}
              >
                {isEditing ? (
                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] mb-1">
                      <span className="font-medium text-[var(--foreground)]">Step {idx + 1}</span>
                      <span>·</span>
                      <span>{step.label}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Assigned employee */}
                      <div>
                        <label className="block text-xs text-[var(--foreground-muted)] mb-1">Assign to</label>
                        <select
                          value={editData.assignedEmployeeId ?? ""}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, assignedEmployeeId: e.target.value || null }))
                          }
                          className="neo-select w-full px-2 py-1.5 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Scheduled date */}
                      <div>
                        <label className="block text-xs text-[var(--foreground-muted)] mb-1">Scheduled date</label>
                        <input
                          type="date"
                          value={editData.scheduledDate ?? ""}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, scheduledDate: e.target.value || null }))
                          }
                          className="neo-input w-full px-2 py-1.5 text-sm"
                        />
                      </div>

                      {/* Duration */}
                      <div>
                        <label className="block text-xs text-[var(--foreground-muted)] mb-1">Duration (minutes)</label>
                        <input
                          type="number"
                          min={1}
                          value={editData.estimatedMinutes ?? ""}
                          onChange={(e) =>
                            setEditData((d) => ({
                              ...d,
                              estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : null,
                            }))
                          }
                          className="neo-input w-full px-2 py-1.5 text-sm"
                          placeholder="e.g. 90"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs text-[var(--foreground-muted)] mb-1">Status</label>
                        <select
                          value={editData.status ?? "pending"}
                          onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}
                          className="neo-select w-full px-2 py-1.5 text-sm"
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs text-[var(--foreground-muted)] mb-1">Notes</label>
                      <textarea
                        value={editData.notes ?? ""}
                        onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value || null }))}
                        rows={2}
                        className="neo-input w-full px-2 py-1.5 text-sm resize-none"
                        placeholder="Optional notes for this step…"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(step.id)} className="neo-btn-primary px-3 py-1.5 text-xs">Save</button>
                      <button onClick={() => { setEditingId(null); setEditData({}); }} className="neo-btn px-3 py-1.5 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Step number + status toggle */}
                    <button
                      onClick={() =>
                        handlePatch(step.id, {
                          status: step.status === "done" ? "pending" : "done",
                        })
                      }
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        step.status === "done"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 text-gray-400 hover:border-emerald-400"
                      }`}
                      title={step.status === "done" ? "Mark pending" : "Mark done"}
                    >
                      {step.status === "done" ? "✓" : idx + 1}
                    </button>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            step.status === "done"
                              ? "line-through text-[var(--foreground-muted)]"
                              : "text-[var(--foreground)]"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[step.status] ?? STATUS_COLORS.pending
                          }`}
                        >
                          {STATUS_LABELS[step.status] ?? step.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-[var(--foreground-muted)]">
                        {/* Employee chip */}
                        {emp ? (
                          <span className="flex items-center gap-1">
                            {emp.color && (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full border border-white/50"
                                style={{ backgroundColor: emp.color }}
                              />
                            )}
                            {emp.name}
                          </span>
                        ) : (
                          <span className="italic">Unassigned</span>
                        )}

                        {step.scheduledDate && (
                          <span>📅 {fmtDate(step.scheduledDate)}</span>
                        )}

                        {step.estimatedMinutes && (
                          <span>⏱ {fmtMinutes(step.estimatedMinutes)}</span>
                        )}

                        {step.description && (
                          <span className="truncate max-w-xs">{step.description}</span>
                        )}
                      </div>

                      {step.notes && (
                        <p className="mt-1 text-xs text-[var(--foreground-muted)] italic">
                          {step.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => startEdit(step)}
                        className="neo-btn px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(step.id)}
                        className="neo-btn px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add step form */}
      {addingStep && (
        <div className="neo-panel-inset p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--foreground-muted)]">New step</p>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Step label (e.g. Sand and finish doors)"
            className="neo-input w-full px-3 py-2 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
          />
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={newMinutes}
              onChange={(e) => setNewMinutes(e.target.value)}
              placeholder="Duration (min)"
              className="neo-input w-36 px-3 py-2 text-sm"
            />
            <button
              onClick={handleAddStep}
              disabled={!newLabel.trim()}
              className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setAddingStep(false); setNewLabel(""); setNewMinutes(""); }}
              className="neo-btn px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
