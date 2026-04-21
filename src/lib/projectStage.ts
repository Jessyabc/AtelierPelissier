/**
 * Stage-derived display helpers — single source of truth for how a project's
 * lifecycle stage is surfaced to users.
 *
 * Business model (confirmed 2026-04-17):
 *   Quote           — no commitment yet; client might never buy
 *   Draft project   — invoice issued, waiting on deposit; client is on the hook
 *   Project         — deposit received, real work begins (planner owns it)
 *   Completed       — delivered / closed out
 *   Archived quote  — quote went stale (2 weeks of no activity, auto)
 *   Lost quote      — quote killed manually with a reason
 *
 * The underlying data is:
 *   - `Project.stage` (string): "quote" | "invoiced" | "confirmed"
 *   - `Project.depositReceivedAt` (DateTime?): when the deposit landed
 *   - `Project.isDone` (bool): terminal complete state
 *   - `Project.isDraft` (bool): LEGACY — retained for migration compat, not
 *     authoritative for UI. Derive display state from `stage` + dates.
 *
 * Prefer calling `getStageView(project)` everywhere the UI needs to decide
 * what to show. It is the only place that reconciles legacy `isDraft` with
 * the modern `stage` column.
 */

/**
 * Minimum shape a project needs to expose for stage derivation. Matches both
 * Prisma rows and API-serialised projects (dates can be Date or ISO string).
 */
export type ProjectStageShape = {
  stage?: string | null;
  isDraft?: boolean;
  isDone?: boolean;
  depositReceivedAt?: string | Date | null;
  // Reserved for the follow-up cycle (archive + lost quote). Kept optional now
  // so this helper stays forward-compatible when the schema gains them.
  archivedAt?: string | Date | null;
  lostReason?: string | null;
};

/**
 * Canonical display states. Treat this enum as the only axis the UI branches
 * on — never compare `project.stage` directly in a component.
 */
export type StageView =
  | "quote"
  | "draft_project"
  | "project"
  | "completed"
  | "archived_quote"
  | "lost_quote";

export type StageLabel = {
  /** Short chip label (e.g. "Quote", "Draft project"). */
  short: string;
  /** Long / tooltip form (e.g. "Draft project — waiting on deposit"). */
  long: string;
  /** Tailwind class suggestion for a pill. */
  chipClass: string;
};

/**
 * Reconcile `stage` + `depositReceivedAt` + `isDone` + `isDraft` into one
 * canonical view. The order below matters — later cases override earlier ones.
 */
export function getStageView(project: ProjectStageShape): StageView {
  if (project.lostReason) return "lost_quote";
  if (project.archivedAt) return "archived_quote";
  if (project.isDone) return "completed";

  const stage = (project.stage ?? "").toLowerCase();
  const hasDeposit = Boolean(project.depositReceivedAt);

  // Deposit landed → real project, no matter what stage still says.
  if (hasDeposit || stage === "confirmed") return "project";
  if (stage === "invoiced") return "draft_project";
  if (stage === "quote") return "quote";

  // Legacy fallback: pre-stage rows where only `isDraft` is set.
  if (project.isDraft) return "quote";
  return "project";
}

/**
 * Display metadata for each stage view. Centralised here so every list,
 * badge, and filter label stays in sync.
 */
export function getStageLabel(view: StageView): StageLabel {
  switch (view) {
    case "quote":
      return {
        short: "Quote",
        long: "Quote — no commitment yet",
        chipClass: "bg-blue-100 text-blue-800",
      };
    case "draft_project":
      return {
        short: "Draft project",
        long: "Draft project — invoice issued, waiting on deposit",
        chipClass: "bg-amber-100 text-amber-800",
      };
    case "project":
      return {
        short: "Project",
        long: "Project — deposit received, in production",
        chipClass: "bg-emerald-100 text-emerald-800",
      };
    case "completed":
      return {
        short: "Completed",
        long: "Completed — delivered",
        chipClass: "bg-gray-100 text-gray-700",
      };
    case "archived_quote":
      return {
        short: "Archived",
        long: "Archived quote — no activity for 2+ weeks",
        chipClass: "bg-gray-100 text-gray-500",
      };
    case "lost_quote":
      return {
        short: "Lost",
        long: "Lost quote — client did not proceed",
        chipClass: "bg-rose-100 text-rose-800",
      };
  }
}

/** Convenience wrapper when a caller just wants the short label. */
export function getStageShortLabel(project: ProjectStageShape): string {
  return getStageLabel(getStageView(project)).short;
}

// ── Predicates ─────────────────────────────────────────────────────────────
// Use these instead of raw `project.stage === "..."` comparisons. They survive
// the `isDraft` legacy reconciliation and future stages (archived, lost).

export function isQuote(p: ProjectStageShape): boolean {
  return getStageView(p) === "quote";
}

export function isDraftProject(p: ProjectStageShape): boolean {
  return getStageView(p) === "draft_project";
}

export function isActiveProject(p: ProjectStageShape): boolean {
  return getStageView(p) === "project";
}

/**
 * True while a salesperson still "owns" the project conceptually (pre-deposit).
 * Planners only take over once a deposit lands — this is the gate for most of
 * the per-role UI divergence.
 */
export function isSalesOwned(p: ProjectStageShape): boolean {
  const v = getStageView(p);
  return v === "quote" || v === "draft_project";
}

/** True when a project is archived or lost — surfaced only via filters. */
export function isHiddenByDefault(p: ProjectStageShape): boolean {
  const v = getStageView(p);
  return v === "archived_quote" || v === "lost_quote";
}

// ── Role-aware CTA labels ──────────────────────────────────────────────────
// Keeps the "new something" wording consistent across menu, header, and empty
// states. Salespeople live in quote-world by default; planner/admin live in
// project-world by default.

export type NewItemLabels = {
  /** Menu / header label, e.g. "New quote" vs "New project". */
  menu: string;
  /** CTA-button label, slightly longer, e.g. "Start a new quote". */
  cta: string;
};

export function getNewItemLabels(role: string | null | undefined): NewItemLabels {
  if (role === "salesperson") {
    return { menu: "New quote", cta: "Start a new quote" };
  }
  return { menu: "New project", cta: "Start a new project" };
}
