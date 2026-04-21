"use client";

import Link from "next/link";
import { BlockedReasonBadge } from "@/components/BlockedReasonBadge";
import { getNextAction, type NextActionProject } from "@/lib/workflow/nextAction";
import type { AppRole } from "@/lib/auth/roles";
import {
  getStageView,
  getStageLabel,
  type ProjectStageShape,
} from "@/lib/projectStage";

export type ProjectCardProject = NextActionProject & {
  name: string;
  type?: string;
  updatedAt: string;
  subProjects?: Array<{ id: string }> | null;
};

type Props = {
  project: ProjectCardProject;
  role: AppRole | string;
  /** Compact variant removes secondary metadata for tight lists. */
  compact?: boolean;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  duplicatingId?: string | null;
};

function formatTypes(typesStr?: string | null, fallbackType?: string | null): string {
  if (typesStr && typesStr.trim()) {
    return typesStr
      .split(",")
      .map((t) => t.trim().replace("_", " "))
      .filter(Boolean)
      .join(", ");
  }
  if (fallbackType) return fallbackType.replace("_", " ");
  return "—";
}

function estimateTotal(lines?: Array<{ amount: number }> | null): number {
  return (lines ?? []).reduce((sum, l) => sum + l.amount, 0);
}

function toneClass(tone: "primary" | "neutral" | "warning" | "success"): string {
  switch (tone) {
    case "primary": return "neo-btn-primary";
    case "warning": return "neo-btn border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100";
    case "success": return "neo-btn text-emerald-700";
    case "neutral":
    default: return "neo-btn";
  }
}

/**
 * Single pill that surfaces the canonical lifecycle stage (Quote /
 * Draft project / Project / Completed / Archived / Lost). Replaces the older
 * pair of "Draft" + "Quote" chips, which double-stated the same fact and
 * confused salespeople. Source of truth lives in `lib/projectStage.ts`.
 */
function StageBadge({ project }: { project: ProjectStageShape }) {
  const view = getStageView(project);
  const { short, long, chipClass } = getStageLabel(view);
  return (
    <span
      title={long}
      className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${chipClass}`}
    >
      {short}
    </span>
  );
}

/**
 * Role-aware project card.
 *
 * Shows the same project data differently depending on the viewer's role:
 * - salesperson: emphasizes price and client
 * - planner/admin: emphasizes material + schedule readiness
 * - woodworker: emphasizes production tasks
 *
 * Every card exposes a single "next action" CTA — the one thing this role
 * should do next on this project. The CTA is resolved via getNextAction().
 */
export function ProjectCard({
  project: p,
  role,
  compact,
  onDuplicate,
  onDelete,
  duplicatingId,
}: Props) {
  const next = getNextAction(p, role);
  const clientName = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ") || "—";
  const types = formatTypes(p.types, p.type);
  const total = estimateTotal(p.costLines ?? undefined);

  // Role-specific secondary line
  let secondaryLine: React.ReactNode;
  if (role === "salesperson") {
    secondaryLine = (
      <span className="text-sm text-gray-500">
        {clientName}
        {total > 0 && (
          <>
            {" · "}
            <span className="font-medium text-gray-700">
              ${total.toLocaleString("en-CA", { minimumFractionDigits: 2 })}
            </span>
          </>
        )}
      </span>
    );
  } else if (role === "planner" || role === "admin") {
    const matState = p.hasStaleMaterialSnapshot
      ? "Materials stale"
      : p.hasMaterialSnapshot
        ? "Materials saved"
        : "Materials pending";
    const matTone = p.hasStaleMaterialSnapshot
      ? "text-amber-700"
      : p.hasMaterialSnapshot
        ? "text-emerald-700"
        : "text-gray-500";
    secondaryLine = (
      <span className="text-sm text-gray-500">
        {types}
        {" · "}
        <span className={matTone}>{matState}</span>
        {p.targetDate && (
          <>
            {" · "}
            Target {new Date(p.targetDate).toLocaleDateString()}
          </>
        )}
      </span>
    );
  } else if (role === "woodworker") {
    secondaryLine = <span className="text-sm text-gray-500">{types}</span>;
  } else {
    secondaryLine = (
      <span className="text-sm text-gray-500">
        {types} · {clientName}
      </span>
    );
  }

  return (
    <li className="neo-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{p.name}</span>
            <StageBadge project={p} />
            {p.blockedReason && <BlockedReasonBadge reason={p.blockedReason} />}
            {p.subProjects && p.subProjects.length > 0 && (
              <span className="text-xs text-gray-500">({p.subProjects.length} tasks)</span>
            )}
          </div>
          {!compact && <div className="mt-1">{secondaryLine}</div>}
          {!compact && (
            <div className="mt-0.5 text-xs text-gray-400">
              Updated {new Date(p.updatedAt).toLocaleDateString()}
            </div>
          )}
        </Link>

        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          {/* Next action CTA — the primary guided-workflow button */}
          <Link
            href={next.href}
            title={next.reason}
            className={`${toneClass(next.tone)} inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium`}
          >
            {next.label}
            {!next.terminal && <span aria-hidden>→</span>}
          </Link>

          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(p.id)}
              disabled={duplicatingId !== null}
              className="neo-btn px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {duplicatingId === p.id ? "…" : "Duplicate"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              className="neo-btn px-3 py-1.5 text-xs font-medium text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
