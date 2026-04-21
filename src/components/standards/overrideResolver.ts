/**
 * Pure helpers for resolving overrides against shop standards.
 *
 * Kept in a JSX-free module so it's testable in isolation (the JSX-bearing
 * StandardsContext.tsx can't be imported by Jest without wiring a second
 * JSX transform — see the `"jsx": "preserve"` comment in tsconfig.json).
 */

import type { ConstructionStandardsData } from "@/lib/ingredients/types";
import { classifyOverride, type RiskTier } from "@/lib/standards/overridePolicy";

// ── Types shared with the context ─────────────────────────────────────

/** Wire-format override row returned by /api/projects/[id]/standards-overrides. */
export type StandardsOverrideDTO = {
  id: string;
  projectId: string;
  standardKey: string;
  standardValue: number;
  overrideValue: number;
  unit: string;
  sectionId: string | null;
  riskTier: "low" | "high" | string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | string;
  createdAt: string;
  reviewedAt: string | null;
};

export type StandardKey = keyof ConstructionStandardsData;

/** Resolved reading for a single standard — value + provenance. */
export type ResolvedStandard = {
  /** The number the builder should actually use right now. */
  value: number;
  /** Where the number came from. "standard" = canonical, rest = override row. */
  source: "standard" | "override-approved" | "override-pending" | "override-rejected";
  /** The canonical standard value (always available, independent of source). */
  standardValue: number;
  /** Active override row if any — most recent non-rejected for this key + section. */
  override: StandardsOverrideDTO | null;
  /** Risk tier for this standard, for UI hints (always resolvable). */
  tier: RiskTier;
  /** UI label to display alongside the value ("Standard", "Admin review", etc.). */
  provenanceLabel: string;
};

// ── Pure resolvers ────────────────────────────────────────────────────

/**
 * Pick the "active" override for a key+section combo. Rules:
 *   1. Section-specific rows win over project-level (null sectionId) when
 *      the caller passes a sectionId.
 *   2. Approved rows win over pending, pending win over rejected.
 *   3. Same status: most recent `createdAt` wins.
 */
export function pickActiveOverride(
  rows: readonly StandardsOverrideDTO[],
  key: string,
  sectionId: string | null | undefined
): StandardsOverrideDTO | null {
  const STATUS_RANK: Record<string, number> = { approved: 0, pending: 1, rejected: 2 };
  const matches = rows.filter((r) => {
    if (r.standardKey !== key) return false;
    if (sectionId) return r.sectionId === sectionId || r.sectionId === null;
    return r.sectionId === null;
  });
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aSec = a.sectionId ? 0 : 1;
    const bSec = b.sectionId ? 0 : 1;
    if (aSec !== bSec) return aSec - bSec;
    const aRank = STATUS_RANK[a.status] ?? 99;
    const bRank = STATUS_RANK[b.status] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return matches[0];
}

/** Human-facing label for an override row (or "Standard" when null). */
export function provenanceLabelForRow(row: StandardsOverrideDTO | null): string {
  if (!row) return "Standard";
  if (row.status === "approved") return "Override approved";
  if (row.status === "pending") {
    return row.riskTier === "high" ? "Override — admin review" : "Override — planner review";
  }
  if (row.status === "rejected") return "Override rejected — showing standard";
  return "Override";
}

/**
 * Full resolver: given the shop standards, the project's override rows,
 * a standard key, and an optional section, return the effective reading.
 *
 * Pure — no side effects, no IO. The hook form lives in StandardsContext.
 */
export function resolveStandard(
  standards: ConstructionStandardsData,
  overrides: readonly StandardsOverrideDTO[],
  key: StandardKey,
  sectionId: string | null | undefined = null
): ResolvedStandard {
  const standardValue = standards[key];
  const override = pickActiveOverride(overrides, key, sectionId);
  const tier = classifyOverride(key).tier;

  let value = standardValue;
  let source: ResolvedStandard["source"] = "standard";
  if (override) {
    if (override.status === "approved") {
      value = override.overrideValue;
      source = "override-approved";
    } else if (override.status === "pending") {
      // Keep the canonical value until approval — builders use real numbers
      // for pricing/cutlist. The UI marks it pending so the user sees the
      // request is in motion.
      value = standardValue;
      source = "override-pending";
    } else if (override.status === "rejected") {
      source = "override-rejected";
    }
  }

  return {
    value,
    source,
    standardValue,
    override,
    tier,
    provenanceLabel: provenanceLabelForRow(override),
  };
}
