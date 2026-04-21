/**
 * Construction-standards override policy.
 *
 * When a project deviates from a canonical ConstructionStandards value, we
 * log a `StandardsOverride` row and stamp it with a risk tier. The tier
 * decides who must approve it before production starts:
 *
 *   "low"  — a planner OR an admin can approve
 *   "high" — admin only
 *
 * We keep the mapping in code (not the schema) so tuning the policy doesn't
 * require a DB migration. When a new standard is added, picking its tier is a
 * one-line diff here.
 *
 * RULE OF THUMB for classifying a standard:
 *   → HIGH when changing it ripples into material purchasing, cutlist yield,
 *     pricing baselines, or hardware compatibility across the whole shop.
 *   → LOW  for local dimensional tweaks that don't shift the pricing model
 *     or the parts bill for other in-flight projects.
 *
 * Unknown keys fall back to "low" — we trust planners, and a brand-new
 * standard that hasn't yet been classified is by definition not mission-
 * critical. Promote to HIGH the moment it starts driving pricing or yield.
 */

import type { ConstructionStandardsData } from "@/lib/ingredients/types";

/** Canonical standard keys (all editable fields on ConstructionStandardsData). */
export type StandardKey = keyof ConstructionStandardsData;

export type RiskTier = "low" | "high";

/**
 * High-risk keys — admin-only approval. Everything else is low-risk.
 *
 * Rationale per key (keep in sync when adding/removing):
 *   kitchenBaseHeight      — shifts usable drawer/door height on every kitchen;
 *                            materials, pricing, hardware sizing all key off this.
 *   kitchenKickplateHeight — paired with kitchenBaseHeight; same ripple.
 *   vanityFreestandingHeight — changes the full vanity pricing model.
 *   panelThickness         — sheet-goods cost and cutlist yield.
 *   backThickness          — same as panelThickness.
 *   drawerBoxHeight        — drives drawer hardware kit purchase.
 *   drawerFrontHeight      — drives drawer front panel cutlist.
 */
const HIGH_RISK_KEYS: ReadonlySet<StandardKey> = new Set<StandardKey>([
  "kitchenBaseHeight",
  "kitchenKickplateHeight",
  "vanityFreestandingHeight",
  "panelThickness",
  "backThickness",
  "drawerBoxHeight",
  "drawerFrontHeight",
]);

/** Resolve the approval tier for a given override key. */
export function getApprovalTier(key: string): RiskTier {
  return HIGH_RISK_KEYS.has(key as StandardKey) ? "high" : "low";
}

/** True if the role is allowed to approve overrides at this tier. */
export function canApprove(role: string, tier: RiskTier): boolean {
  if (role === "admin") return true;
  if (tier === "low" && role === "planner") return true;
  return false;
}

/**
 * Helper used by API routes when a request comes in with a single `key`:
 * returns the tier and whether the caller is allowed to fast-track their
 * own request (they are not — just centralised for UI affordances like
 * showing "Admin review required" up-front).
 */
export type OverrideRequestClassification = {
  key: string;
  tier: RiskTier;
  /** Short label for UI chips — "Planner review" / "Admin review". */
  reviewLabel: string;
};

export function classifyOverride(key: string): OverrideRequestClassification {
  const tier = getApprovalTier(key);
  return {
    key,
    tier,
    reviewLabel: tier === "high" ? "Admin review" : "Planner review",
  };
}
