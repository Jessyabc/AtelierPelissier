import { DEFAULT_KITCHEN_MARKUP } from "@/config/kitchenPricingBuilder";

/**
 * Construction-standard keys that feed kitchen room defaults (Step 1).
 * Pending overrides on other keys (e.g. vanity depth) must not block kitchen submit.
 */
export const KITCHEN_SUBMIT_GATE_STANDARD_KEYS: readonly string[] = [
  "kitchenBaseHeight",
  "kitchenBaseDepth",
  "kitchenKickplateHeight",
  "kitchenTopSilenceHeight",
];

export function isKitchenSubmitGateStandardKey(key: string): boolean {
  return KITCHEN_SUBMIT_GATE_STANDARD_KEYS.includes(key);
}

export function isKitchenAdminRole(role: string): boolean {
  return role === "admin";
}

export function isKitchenManagerRole(role: string): boolean {
  return role === "admin" || role === "planner";
}

export function canUserSeeBreakdown(role: string): boolean {
  return isKitchenManagerRole(role);
}

export function canUserChangeMultiplier(role: string): boolean {
  return role === "admin" || role === "planner" || role === "salesperson";
}

export function canUserRequestDiscount(role: string): boolean {
  return role === "admin" || role === "planner" || role === "salesperson";
}

export function requiresManagerReview(multiplier: number): boolean {
  return multiplier !== DEFAULT_KITCHEN_MARKUP;
}
