/** Application roles (stored on User.role and optionally mirrored on Employee.role). */
export const APP_ROLES = ["admin", "planner", "salesperson", "woodworker"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

/** Can schedule service calls / calendar (AI + manual). */
export function canSchedule(role: string): boolean {
  return role === "admin" || role === "planner" || role === "salesperson";
}

/** Can change integrations and app config. */
export function canManageIntegrations(role: string): boolean {
  return role === "admin";
}

/** Can approve high-impact AI actions (orders, inventory, Monday). */
export function canApproveAiActions(role: string): boolean {
  return role === "admin" || role === "planner";
}

/** Manager-tier pricing approvals (admin stays unrestricted superuser). */
export function canApproveKitchenPricing(role: string): boolean {
  return role === "admin" || role === "planner";
}

/** Internal kitchen cost breakdown is hidden from sales unless manager-tier. */
export function canSeeKitchenCostBreakdown(role: string): boolean {
  return role === "admin" || role === "planner";
}

// ── Role → page access ────────────────────────────────────────────────
// Delegated to `src/config/menu.ts` — one source of truth for which role
// sees which page. Middleware and AppHeader both route through these helpers.

import { MASTER_MENU, isMenuItemVisibleToRole, isPathAllowedForRole } from "@/config/menu";

/** True if a role may visit this pathname (middleware + layout guard). */
export function isPageAllowedForRole(pathname: string, role: string): boolean {
  return isPathAllowedForRole(pathname, role);
}

/** True if a menu entry (by href) should appear for this role. */
export function isMenuItemAllowedForRole(href: string, role: string): boolean {
  const item = MASTER_MENU.find((m) => m.href === href);
  if (!item) return false;
  return isMenuItemVisibleToRole(item, role);
}

/** Default landing page after login (no ?next= param). */
export function getDefaultLandingPage(role: string): string {
  switch (role) {
    case "woodworker": return "/today";
    case "planner": return "/home";
    case "admin": return "/";
    case "salesperson": return "/";
    default: return "/";
  }
}
