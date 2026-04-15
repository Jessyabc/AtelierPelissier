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

// ── Role → page access map ────────────────────────────────────────────
// Used by middleware (page gating) and AppHeader (menu filtering).

const ALL_PAGES = [
  "/", "/home", "/projects/new", "/assistant", "/dashboard",
  "/inventory", "/distributors", "/costing", "/processes",
  "/service-calls", "/calendar", "/settings/risk", "/purchasing",
  "/admin", "/admin/employees", "/admin/stations", "/admin/punches",
  "/admin/invites", "/onboarding", "/structure", "/today",
] as const;

const ROLE_PAGE_ACCESS: Record<AppRole, readonly string[]> = {
  admin: ALL_PAGES,
  planner: [
    "/", "/home", "/projects/new", "/assistant", "/dashboard",
    "/inventory", "/distributors", "/costing", "/processes",
    "/service-calls", "/calendar", "/onboarding", "/today",
  ],
  salesperson: [
    "/", "/projects/new", "/assistant", "/service-calls",
    "/calendar", "/distributors", "/costing", "/onboarding", "/today",
  ],
  woodworker: [
    "/assistant", "/calendar", "/onboarding", "/today",
  ],
};

/** Menu items (by href) each role is allowed to see. */
export function isPageAllowedForRole(pathname: string, role: string): boolean {
  const allowed = ROLE_PAGE_ACCESS[role as AppRole];
  if (!allowed) return false;
  // Exact match first
  if (allowed.includes(pathname)) return true;
  // Dynamic sub-paths: /projects/[id], /processes/[id], /punch/[station] — always allowed if parent is
  // Projects are accessible either via the Projects list ("/") or via Calendar ("/calendar") links.
  if (pathname.startsWith("/projects/") && (allowed.includes("/") || allowed.includes("/calendar"))) return true;
  if (pathname.startsWith("/processes/") && allowed.includes("/processes")) return true;
  if (pathname.startsWith("/punch/")) return true;
  if (pathname.startsWith("/admin/") && allowed.some((p) => p.startsWith("/admin"))) return true;
  return false;
}

/** Menu href filter: returns true if the menu item should be shown to this role. */
export function isMenuItemAllowedForRole(href: string, role: string): boolean {
  if (href === "#export") return role === "admin";
  const allowed = ROLE_PAGE_ACCESS[role as AppRole];
  if (!allowed) return false;
  if (allowed.includes(href)) return true;
  // Admin sub-pages are accessible if /admin is allowed
  if (href.startsWith("/admin") && allowed.some((p) => p.startsWith("/admin"))) return true;
  return false;
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
