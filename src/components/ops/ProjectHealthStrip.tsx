"use client";

import Link from "next/link";
import type { ProjectHealth } from "@/app/home/page";
import { BlockedReasonBadge } from "@/components/BlockedReasonBadge";

const severityColor: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-500",
  medium: "text-yellow-600",
  low: "text-blue-500",
};

const statusDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
};

export function ProjectHealthStrip({ projects }: { projects: ProjectHealth[] }) {
  const blocked = projects.filter((p) => p.blockedReason);
  const activeNotBlocked = projects.filter((p) => !p.isDraft && !p.blockedReason);
  const drafts = projects.filter((p) => p.isDraft && !p.blockedReason);

  if (projects.length === 0) {
    return (
      <div className="neo-panel-inset p-6 text-center text-[var(--foreground-muted)]">
        No active projects
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Project Health</h2>
      {blocked.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-red-700 mb-2">Blocked</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {blocked.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      )}
      {activeNotBlocked.length > 0 && (
        <div className="mb-2">
          <h3 className="text-sm font-medium text-[var(--foreground-muted)] mb-2">Active</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {activeNotBlocked.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      )}
      {drafts.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm text-[var(--foreground-muted)] cursor-pointer">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </summary>
          <div className="flex gap-4 overflow-x-auto pb-2 mt-2 -mx-1 px-1">
            {drafts.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function ProjectCard({ project: p }: { project: ProjectHealth }) {
  const statusClass = p.worstSeverity
    ? `severity-${p.worstSeverity}`
    : "";

  const targetStr = p.targetDate
    ? new Date(p.targetDate).toLocaleDateString("en-CA")
    : null;

  return (
    <Link
      href={`/projects/${p.id}`}
      className={`neo-card p-4 min-w-[220px] max-w-[260px] flex-shrink-0 block transition-all hover:translate-y-[-2px] ${statusClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-[var(--foreground)] truncate">
            {p.jobNumber ? `${p.jobNumber} — ` : ""}{p.name}
          </div>
          {p.blockedReason && (
            <div className="mt-1">
              <BlockedReasonBadge reason={p.blockedReason} className="text-[10px] leading-tight py-0" />
            </div>
          )}
          {p.clientName && (
            <div className="text-xs text-[var(--foreground-muted)] truncate">{p.clientName}</div>
          )}
        </div>
        {p.worstSeverity && (
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${statusDot[p.worstSeverity] ?? "bg-gray-300"}`} />
        )}
        {!p.worstSeverity && (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-emerald-400" />
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {/* Material fulfillment bar */}
        <div>
          <div className="flex justify-between text-xs text-[var(--foreground-muted)]">
            <span>Material</span>
            <span>{p.fulfillmentPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--shadow-dark)] mt-0.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, p.fulfillmentPct)}%`,
                background: p.fulfillmentPct >= 100 ? "#34d399" : p.fulfillmentPct >= 50 ? "var(--accent)" : "#f59e0b",
              }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-[var(--foreground-muted)]">Margin</span>
          <span className={p.margin < 15 ? "text-red-500 font-medium" : "text-[var(--foreground)]"}>
            {p.margin}%
          </span>
        </div>

        {targetStr && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--foreground-muted)]">Target</span>
            <span className="text-[var(--foreground)]">{targetStr}</span>
          </div>
        )}

        {p.deviationCount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--foreground-muted)]">Issues</span>
            <span className={`font-medium ${severityColor[p.worstSeverity ?? "low"]}`}>
              {p.deviationCount}
            </span>
          </div>
        )}
      </div>

      {p.isDraft && (
        <span className="inline-block mt-2 text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-muted)] bg-[var(--bg-light)] px-2 py-0.5 rounded-full">
          Draft
        </span>
      )}
    </Link>
  );
}
