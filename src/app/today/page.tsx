"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Employee = { id: string; name: string; color: string | null; role: string };

type StepItem = {
  id: string;
  label: string;
  description: string | null;
  status: string;
  estimatedMinutes: number | null;
  scheduledDate: string | null;
  notes: string | null;
  project: { id: string; name: string; jobNumber: string | null };
  step?: { id: string; label: string } | null;
};

type SalesRow = {
  project: { id: string; name: string; jobNumber: string | null; stage: string; isDraft: boolean; updatedAt: string };
  action: { label: string; href: string; reason?: string; tone: string };
  priority: number;
};

type BuilderTodo = {
  projectId: string;
  projectName: string;
  jobNumber: string | null;
  type: "vanity" | "side_unit";
  roomLabel: string;
};

type PlannerJob = {
  project: { id: string; name: string; jobNumber: string | null };
  blocking: { id: string; label: string } | null;
  steps: Array<{
    id: string;
    label: string;
    status: string;
    sortOrder: number;
    scheduledDate: string | null;
    assignedEmployee: { id: string; name: string; role: string; color: string | null } | null;
    isOverdue: boolean;
  }>;
};

type TodayData = {
  role: string;
  employee: Employee | null;
  today: StepItem[];
  week: StepItem[];
  overdue: StepItem[];
  salesResponsibilities?: SalesRow[];
  builderTodos?: BuilderTodo[];
  plannerJobs?: PlannerJob[];
};

function fmtMinutes(min: number | null): string {
  if (!min) return "";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-CA");
}

function toneClass(tone: string): string {
  switch (tone) {
    case "warning": return "border-l-4 border-amber-400";
    case "primary": return "border-l-4 border-[var(--accent)]";
    case "success": return "border-l-4 border-emerald-500";
    default: return "border-l-4 border-[var(--foreground-muted)]/40";
  }
}

function StepCard({
  step,
  projectId,
  onMarkDone,
  onMarkInProgress,
  highlight,
}: {
  step: StepItem;
  projectId: string;
  onMarkDone: (id: string) => void;
  onMarkInProgress: (id: string) => void;
  highlight?: "overdue" | "today";
}) {
  const isDone = step.status === "done";
  const isInProgress = step.status === "in_progress";

  return (
    <div
      className={`neo-card p-4 transition-all ${isDone ? "opacity-50" : ""} ${
        highlight === "overdue" ? "border-l-4 border-red-400" : ""
      } ${highlight === "today" ? "border-l-4 border-[var(--accent)]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => (isDone ? onMarkInProgress(step.id) : onMarkDone(step.id))}
          className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition-colors ${
            isDone
              ? "border-emerald-500 bg-emerald-500 text-white"
              : isInProgress
              ? "border-blue-500 bg-blue-50 text-blue-600"
              : "border-gray-300 text-gray-300 hover:border-emerald-400"
          }`}
          title={isDone ? "Mark pending" : "Mark done"}
        >
          {isDone ? "✓" : isInProgress ? "▶" : ""}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug ${
              isDone ? "line-through text-[var(--foreground-muted)]" : "text-[var(--foreground)]"
            }`}
          >
            {step.label}
          </p>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--foreground-muted)]">
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-[var(--accent)] hover:underline truncate max-w-[180px]"
            >
              {step.project.jobNumber ? `#${step.project.jobNumber} · ` : ""}
              {step.project.name}
            </Link>
            {step.estimatedMinutes ? (
              <span>⏱ {fmtMinutes(step.estimatedMinutes)}</span>
            ) : null}
            {step.scheduledDate && (
              <span className={highlight === "overdue" ? "text-red-500 font-medium" : ""}>
                📅 {fmtDate(step.scheduledDate)}
              </span>
            )}
          </div>

          {step.notes && (
            <p className="mt-1 text-xs italic text-[var(--foreground-muted)]">{step.notes}</p>
          )}
        </div>

        {!isDone && !isInProgress && (
          <button
            onClick={() => onMarkInProgress(step.id)}
            className="flex-shrink-0 neo-btn px-2 py-1 text-xs text-blue-600"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sales view ──────────────────────────────────────────────────────────
// Sales users see the projects they need to push forward today.
// Intentionally no production-floor tasks — those are noise for sales.
function SalesTodayView({ data }: { data: TodayData }) {
  const rows = data.salesResponsibilities ?? [];
  const todos = data.builderTodos ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Your day</h1>
        <p className="text-xs text-[var(--foreground-muted)] capitalize">
          Sales · {new Date().toLocaleDateString("fr-CA", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {todos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Builder todos ({todos.length})
          </h2>
          <p className="text-[11px] text-[var(--foreground-muted)]">
            Rooms waiting for their builder input — finish these so the shop can plan.
          </p>
          {todos.map((t) => (
            <Link
              key={`${t.projectId}-${t.type}`}
              href={`/projects/${t.projectId}?tab=Estimates+%26+Costs`}
              className="neo-card p-4 flex items-center justify-between hover:translate-y-[-1px] transition-transform border-l-4 border-amber-400"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {t.jobNumber ? `#${t.jobNumber} · ` : ""}{t.projectName}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  Build {t.type === "vanity" ? "the vanity" : "the side unit"}:{" "}
                  <span className="font-medium text-[var(--foreground)]">{t.roomLabel}</span>
                </p>
              </div>
              <span className="text-xs text-amber-600 font-semibold">Open →</span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Sales responsibilities ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">
            Nothing pressing right now. ✅
          </div>
        ) : (
          rows.map((r) => (
            <Link
              key={r.project.id}
              href={r.action.href}
              className={`neo-card p-4 flex items-start justify-between gap-3 hover:translate-y-[-1px] transition-transform ${toneClass(r.action.tone)}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {r.project.jobNumber ? `#${r.project.jobNumber} · ` : ""}{r.project.name}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  {r.action.label}
                  {r.action.reason ? <span className="ml-1 opacity-80">— {r.action.reason}</span> : null}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] whitespace-nowrap">
                {r.project.stage}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

// ── Planner view ────────────────────────────────────────────────────────
// Planner/admin see every job's day of work, grouped by project, with the
// blocking step surfaced on top.
function PlannerTodayView({ data }: { data: TodayData }) {
  const jobs = data.plannerJobs ?? [];
  const total = jobs.reduce((s, j) => s + j.steps.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Shop day overview</h1>
        <p className="text-xs text-[var(--foreground-muted)] capitalize">
          Planner · {new Date().toLocaleDateString("fr-CA", { weekday: "long", month: "long", day: "numeric" })}
          {total > 0 ? ` · ${total} step${total > 1 ? "s" : ""} across ${jobs.length} job${jobs.length > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">
          Nothing on the floor today.
        </div>
      ) : (
        jobs.map((j) => (
          <section key={j.project.id} className="neo-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/projects/${j.project.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                {j.project.jobNumber ? `#${j.project.jobNumber} · ` : ""}{j.project.name}
              </Link>
              {j.blocking && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Blocking: {j.blocking.label}
                </span>
              )}
            </div>

            <ul className="space-y-1.5">
              {j.steps.map((s, idx) => {
                const isBlocking = j.blocking?.id === s.id;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-3 text-xs rounded px-2 py-1.5 ${
                      s.isOverdue ? "bg-red-50" : isBlocking ? "bg-amber-50" : idx % 2 === 1 ? "bg-[var(--bg-light)]/40" : ""
                    }`}
                  >
                    <span className="w-5 text-center text-[var(--foreground-muted)]">{idx + 1}</span>
                    <span
                      className={`flex-1 ${s.status === "done" ? "line-through text-[var(--foreground-muted)]" : "text-[var(--foreground)]"}`}
                    >
                      {s.label}
                    </span>
                    {s.assignedEmployee ? (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]">
                        {s.assignedEmployee.color && (
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.assignedEmployee.color }}
                          />
                        )}
                        {s.assignedEmployee.name}
                        <span className="opacity-60">({s.assignedEmployee.role})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-muted)] italic">Unassigned</span>
                    )}
                    <span className="text-[10px] text-[var(--foreground-muted)] uppercase">{s.status.replace("_", " ")}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/today");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStep(stepId: string, projectId: string, status: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/process-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error("Update failed"); return; }
      await load();
    } catch {
      toast.error("Failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-[var(--foreground-muted)]">Loading your tasks…</p>
      </div>
    );
  }

  if (!data) return null;

  // Sales-first view — no production-floor noise.
  if (data.role === "salesperson") {
    return <SalesTodayView data={data} />;
  }

  // Planner-first view — all shop jobs grouped.
  if (data.role === "planner") {
    return <PlannerTodayView data={data} />;
  }

  // Admin sees both planner overview and (if they have employee links)
  // their personal queue below.
  if (data.role === "admin") {
    return (
      <div className="space-y-10">
        <PlannerTodayView data={data} />
        {data.employee && (
          <div className="max-w-lg mx-auto px-4">
            <hr className="my-6 border-[var(--foreground-muted)]/10" />
            <p className="text-xs text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">
              Your personal queue
            </p>
            <WoodworkerQueue data={data} onUpdate={updateStep} />
          </div>
        )}
      </div>
    );
  }

  // Woodworker (default) — classic per-employee queue.
  if (!data.employee) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-2xl">🔧</p>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">No employee profile linked</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Ask an admin to link your account to an employee record so you can see your assigned tasks here.
        </p>
        <Link href="/" className="neo-btn px-4 py-2 text-sm inline-block">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <WoodworkerQueue data={data} onUpdate={updateStep} />
    </div>
  );
}

function WoodworkerQueue({
  data,
  onUpdate,
}: {
  data: TodayData;
  onUpdate: (stepId: string, projectId: string, status: string) => void;
}) {
  const { employee, today, week, overdue } = data;
  if (!employee) return null;
  const totalToday = today.length + overdue.length;
  const doneToday = today.filter((s) => s.status === "done").length;
  const totalMinutes = today.reduce((s, st) => s + (st.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {employee.color && (
          <span
            className="w-10 h-10 rounded-full border-2 border-white shadow flex-shrink-0"
            style={{ backgroundColor: employee.color }}
          />
        )}
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{employee.name}</h1>
          <p className="text-xs text-[var(--foreground-muted)] capitalize">{employee.role}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-[var(--foreground-muted)]">
            {new Date().toLocaleDateString("fr-CA", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {totalMinutes > 0 && (
            <p className="text-xs text-[var(--foreground-muted)]">
              ~{fmtMinutes(totalMinutes)} today
            </p>
          )}
        </div>
      </div>

      {totalToday > 0 && (
        <div className="neo-panel-inset px-4 py-2 flex items-center gap-3">
          <div className="flex-1 h-2 bg-[var(--bg-light)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all"
              style={{ width: `${Math.round((doneToday / totalToday) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-[var(--foreground-muted)] flex-shrink-0">
            {doneToday}/{totalToday}
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">
            Overdue ({overdue.length})
          </h2>
          {overdue.map((s) => (
            <StepCard
              key={s.id}
              step={s}
              projectId={s.project.id}
              highlight="overdue"
              onMarkDone={(id) => onUpdate(id, s.project.id, "done")}
              onMarkInProgress={(id) => onUpdate(id, s.project.id, "in_progress")}
            />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Today{today.length > 0 ? ` (${today.length})` : ""}
        </h2>
        {today.length === 0 ? (
          <div className="neo-panel-inset p-6 text-center text-sm text-[var(--foreground-muted)]">
            Nothing scheduled for today. 🎉
          </div>
        ) : (
          today.map((s) => (
            <StepCard
              key={s.id}
              step={s}
              projectId={s.project.id}
              highlight="today"
              onMarkDone={(id) => onUpdate(id, s.project.id, "done")}
              onMarkInProgress={(id) => onUpdate(id, s.project.id, "in_progress")}
            />
          ))
        )}
      </section>

      {week.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Coming up ({week.length})
          </h2>
          {week.map((s) => (
            <StepCard
              key={s.id}
              step={s}
              projectId={s.project.id}
              onMarkDone={(id) => onUpdate(id, s.project.id, "done")}
              onMarkInProgress={(id) => onUpdate(id, s.project.id, "in_progress")}
            />
          ))}
        </section>
      )}

      {overdue.length === 0 && today.length === 0 && week.length === 0 && (
        <div className="neo-panel-inset p-8 text-center space-y-2">
          <p className="text-2xl">✅</p>
          <p className="text-sm font-medium text-[var(--foreground)]">All clear!</p>
          <p className="text-xs text-[var(--foreground-muted)]">
            No steps assigned to you for today or this week.
          </p>
        </div>
      )}
    </div>
  );
}
