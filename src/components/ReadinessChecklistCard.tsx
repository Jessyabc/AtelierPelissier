"use client";

import { computeReadinessCheck } from "@/lib/readiness";

const FIELD_LABELS: Record<string, string> = {
  jobNumber: "Job number",
  client: "Client (linked or first + last name)",
  targetDate: "Target date",
  projectItems: "At least one room / deliverable",
};

type ProjectLike = {
  jobNumber?: string | null;
  clientId?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  targetDate?: string | null;
  projectItems?: unknown[] | null;
};

export function ReadinessChecklistCard({ project }: { project: ProjectLike }) {
  const targetDate = project.targetDate ? new Date(project.targetDate) : null;
  const { ready, missing } = computeReadinessCheck({
    jobNumber: project.jobNumber,
    clientId: project.clientId,
    clientFirstName: project.clientFirstName,
    clientLastName: project.clientLastName,
    targetDate,
    projectItemCount: project.projectItems?.length ?? 0,
  });

  const items = ["jobNumber", "client", "targetDate", "projectItems"] as const;
  return (
    <div className="neo-card p-4 border-l-4 border-[var(--accent)]">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Publish readiness</h3>
      <p className="text-xs text-[var(--foreground-muted)] mb-3">
        Required before you can leave draft (when strict gate is on, incomplete saves are rejected).
      </p>
      <ul className="space-y-2">
        {items.map((key) => {
          const ok = !missing.includes(key);
          return (
            <li
              key={key}
              className={`flex items-center gap-2 text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}
            >
              <span className="font-mono text-xs w-5">{ok ? "✓" : "✗"}</span>
              <span>{FIELD_LABELS[key] ?? key}</span>
            </li>
          );
        })}
      </ul>
      {!ready && (
        <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
          Fix the items marked in red, then use Save project.
        </p>
      )}
    </div>
  );
}
