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

type TodayData = {
  employee: Employee | null;
  today: StepItem[];
  week: StepItem[];
  overdue: StepItem[];
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
        {/* Done toggle */}
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

        {/* Start / In-progress button (if not done, not already in progress) */}
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

  if (!data?.employee) {
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

  const { employee, today, week, overdue } = data;
  const totalToday = today.length + overdue.length;
  const doneToday = today.filter((s) => s.status === "done").length;
  const totalMinutes = today.reduce((s, st) => s + (st.estimatedMinutes ?? 0), 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Personal header */}
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

      {/* Progress pill */}
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

      {/* Overdue */}
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
              onMarkDone={(id) => updateStep(id, s.project.id, "done")}
              onMarkInProgress={(id) => updateStep(id, s.project.id, "in_progress")}
            />
          ))}
        </section>
      )}

      {/* Today */}
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
              onMarkDone={(id) => updateStep(id, s.project.id, "done")}
              onMarkInProgress={(id) => updateStep(id, s.project.id, "in_progress")}
            />
          ))
        )}
      </section>

      {/* This week */}
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
              onMarkDone={(id) => updateStep(id, s.project.id, "done")}
              onMarkInProgress={(id) => updateStep(id, s.project.id, "in_progress")}
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
