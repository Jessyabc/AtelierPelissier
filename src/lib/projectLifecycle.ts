/**
 * Project lifecycle helpers — staleness, follow-up pressure, and auto-archive
 * eligibility for sales-owned projects.
 *
 * This module is the single source of truth for three questions that get
 * asked all over the app:
 *
 *   1. "Is this quote stale? Should we nudge the salesperson?"
 *      → `getSalesFollowUpReason(project, now, thresholds)`
 *
 *   2. "Is this quote old enough to auto-archive?"
 *      → `shouldAutoArchive(project, now, thresholds)`
 *
 *   3. "When was the last meaningful sales touch?"
 *      → `effectiveLastSalesActivity(project)`
 *
 * Keeping the rules here (and out of every consumer) means tuning the
 * follow-up cadence is a one-line diff — which is exactly what the owner
 * has already flagged as a "2/3 week calibration" concern.
 *
 * ── Design ────────────────────────────────────────────────────────────
 *
 * Inputs flow through the `ProjectLifecycleShape` type, which extends
 * `ProjectStageShape` with the two new columns added by the
 * 20260417230000_add_project_lifecycle_fields migration. The stage module
 * already knows how to read `archivedAt`/`lostReason`, so `getStageView`
 * keeps working without any changes here.
 *
 * Thresholds default to the values on `ConstructionStandards`, which is
 * where the admin edits them. Callers that read thresholds from the DB
 * should pass them in explicitly so we stay pure (no I/O).
 *
 * Dates can be `Date` or ISO string — matched to the project shape used
 * everywhere else in the app (Prisma rows vs API-serialised payloads).
 */

import {
  getStageView,
  type ProjectStageShape,
  type StageView,
} from "@/lib/projectStage";

// ── Types ──────────────────────────────────────────────────────────────

/**
 * Minimum shape needed for lifecycle reasoning. Strictly a superset of
 * `ProjectStageShape` — callers can pass raw Prisma rows as-is.
 */
export type ProjectLifecycleShape = ProjectStageShape & {
  updatedAt?: string | Date | null;
  /**
   * Last sales-relevant touch (intake save, quote send, invoice issue,
   * deposit record). Null on legacy rows pre-backfill; callers should
   * fall back to `updatedAt` in that case — use `effectiveLastSalesActivity`.
   */
  lastSalesActivityAt?: string | Date | null;
  archiveReason?: string | null;
};

/**
 * Follow-up thresholds — mirror of the admin-tuned
 * `ConstructionStandards.quoteFollowUpDays` / `invoiceFollowUpDays`.
 *
 * `quoteArchiveAfterDays` is derived separately: "auto-archive a quote
 * after this many days of silence, regardless of the follow-up cadence".
 * Keeping it independent lets us say "nudge after 14, archive after 28".
 */
export type FollowUpThresholds = {
  quoteFollowUpDays: number;
  invoiceFollowUpDays: number;
  quoteArchiveAfterDays: number;
};

/**
 * Defaults used when the caller hasn't loaded `ConstructionStandards`
 * yet (e.g. client-side derivations). Kept in lockstep with the schema
 * defaults in prisma/schema.prisma.
 */
export const DEFAULT_FOLLOWUP_THRESHOLDS: FollowUpThresholds = {
  quoteFollowUpDays: 14,
  invoiceFollowUpDays: 7,
  quoteArchiveAfterDays: 28, // 2× quote follow-up — user rule: "archive after 2 weeks"
                             // is interpreted here as "nudge at 2w, archive at 4w"
                             // so a nudged quote still has time to land before
                             // disappearing from default lists.
};

/** What `getSalesFollowUpReason` returns when follow-up is due. */
export type SalesFollowUpReason = {
  /** Which stage-view triggered the follow-up — lets callers pick wording. */
  view: Extract<StageView, "quote" | "draft_project">;
  /** Days since `effectiveLastSalesActivity(project)` — always ≥ threshold. */
  daysSinceActivity: number;
  /** The threshold that triggered this follow-up, for UI tooltips. */
  thresholdDays: number;
  /** Short label ready for UI, e.g. "Follow up — 18 days quiet". */
  label: string;
};

// ── Internals ──────────────────────────────────────────────────────────

/** Coerce `Date | string | null | undefined` to a Date, or null. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Integer whole days between `from` and `now`. Negative values clamp to 0
 * (future timestamps happen in tests with mocked clocks — we don't want to
 * say "quiet for -3 days").
 */
function daysBetween(from: Date, now: Date): number {
  const ms = now.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ── Public helpers ─────────────────────────────────────────────────────

/**
 * Best-available timestamp for "when did someone in sales last touch this".
 *
 * Priority:
 *   1. `lastSalesActivityAt` (the dedicated column, maintained by sales
 *      write paths)
 *   2. `updatedAt`           (conservative fallback — over-estimates activity
 *      because planner edits also bump it, but it never falsely says
 *      "this project has been silent forever")
 *   3. null                  (only if the row has neither — shouldn't happen
 *      in practice since Prisma sets `updatedAt` on create)
 */
export function effectiveLastSalesActivity(
  project: ProjectLifecycleShape
): Date | null {
  return toDate(project.lastSalesActivityAt) ?? toDate(project.updatedAt);
}

/**
 * True if the project is in a stage where sales activity matters for
 * follow-up (i.e. `quote` or `draft_project`). Completed / archived / lost /
 * active-project rows are excluded — those are someone else's problem.
 */
export function isSalesFollowUpCandidate(
  project: ProjectLifecycleShape
): boolean {
  const view = getStageView(project);
  return view === "quote" || view === "draft_project";
}

/**
 * If this project is a sales-follow-up candidate AND it has been quiet for
 * longer than the stage's follow-up threshold, return the reason payload.
 * Otherwise return null.
 *
 * `now` is injected so tests and cron jobs can pin the clock.
 */
export function getSalesFollowUpReason(
  project: ProjectLifecycleShape,
  now: Date = new Date(),
  thresholds: FollowUpThresholds = DEFAULT_FOLLOWUP_THRESHOLDS
): SalesFollowUpReason | null {
  const view = getStageView(project);
  if (view !== "quote" && view !== "draft_project") return null;

  const lastActivity = effectiveLastSalesActivity(project);
  if (!lastActivity) return null;

  const days = daysBetween(lastActivity, now);
  const thresholdDays =
    view === "quote" ? thresholds.quoteFollowUpDays : thresholds.invoiceFollowUpDays;

  if (days < thresholdDays) return null;

  const wording =
    view === "quote"
      ? `Follow up on quote — ${days} day${days === 1 ? "" : "s"} quiet`
      : `Chase deposit — ${days} day${days === 1 ? "" : "s"} since invoice activity`;

  return {
    view,
    daysSinceActivity: days,
    thresholdDays,
    label: wording,
  };
}

/**
 * True if an auto-archive sweep should pull this project into "Archived".
 *
 * Rules (intentionally narrow so we don't silently hide work):
 *   - Stage view must be `quote` — we NEVER auto-archive invoiced/draft
 *     projects. Those represent issued invoices that a human must resolve,
 *     either by recording a deposit or by explicitly marking the quote
 *     lost. Silently archiving an invoiced project would hide money left
 *     on the table.
 *   - Project must not already be archived / lost / done.
 *   - Days since last sales activity must exceed `quoteArchiveAfterDays`.
 */
export function shouldAutoArchive(
  project: ProjectLifecycleShape,
  now: Date = new Date(),
  thresholds: FollowUpThresholds = DEFAULT_FOLLOWUP_THRESHOLDS
): boolean {
  const view = getStageView(project);
  if (view !== "quote") return false;

  const lastActivity = effectiveLastSalesActivity(project);
  if (!lastActivity) return false;

  return daysBetween(lastActivity, now) >= thresholds.quoteArchiveAfterDays;
}

/**
 * Days since last sales activity, or null if the row has no usable
 * timestamp. Handy for UIs that want to show a "18d quiet" badge even on
 * projects that aren't follow-up candidates yet.
 */
export function daysSinceLastSalesActivity(
  project: ProjectLifecycleShape,
  now: Date = new Date()
): number | null {
  const last = effectiveLastSalesActivity(project);
  if (!last) return null;
  return daysBetween(last, now);
}

/**
 * Merge `ConstructionStandards` into a `FollowUpThresholds`. Callers that
 * load the admin-tuned standards should prefer this over passing defaults.
 *
 * `quoteArchiveAfterDays` is not on `ConstructionStandards` today — we derive
 * it as `2 × quoteFollowUpDays`, which matches the owner's "nudge at 2
 * weeks, archive at 4 weeks" expectation. If the admin later wants a
 * separate knob we'll add a column and update this mapping.
 */
export function thresholdsFromStandards(standards: {
  quoteFollowUpDays: number;
  invoiceFollowUpDays: number;
}): FollowUpThresholds {
  return {
    quoteFollowUpDays: standards.quoteFollowUpDays,
    invoiceFollowUpDays: standards.invoiceFollowUpDays,
    quoteArchiveAfterDays: standards.quoteFollowUpDays * 2,
  };
}
