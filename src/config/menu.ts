/**
 * Single source of truth for the application navigation menu.
 *
 * Design intent (2026-04-15 audit):
 *   • One master menu exists. Roles do NOT get different menus — they get
 *     different *visibility masks* over the same master menu.
 *   • This keeps the UX identical in shape (same groups, same positions)
 *     so someone switching roles (or being promoted) isn't relearning the app.
 *   • Admin sees everything. Other roles see a subset. Impersonation works
 *     by applying another role's mask while the real role stays admin.
 *
 * To change the menu, only edit this file — AppHeader.tsx reads from here,
 * and /api/admin/config merges admin overrides on top.
 */

import type { AppRole } from "@/lib/auth/roles";

export type MenuGroupKey = "Work" | "Ops" | "Tools" | "Config";

export type MenuItem = {
  /** Next.js route or "#action" for a client-side action (e.g. "#export"). */
  href: string;
  /** Default label shown in the dropdown. */
  label: string;
  /**
   * Optional per-role label overrides. Used for items that mean different
   * things depending on who's looking — e.g. salespeople think "New quote",
   * planners think "New project", but it's the same destination.
   *
   * Resolved through `getMenuLabelForRole(item, role)`.
   */
  roleLabels?: Partial<Record<AppRole, string>>;
  /** Soft-hide flag admins can flip from Admin Hub. */
  visible: boolean;
  /** Lower = earlier in the group. */
  order: number;
  /** Group heading. */
  group: MenuGroupKey;
  /** Roles that can see this item. "*" = every authenticated role. */
  roles: readonly AppRole[] | "*";
  /** If true, clicking it triggers the export action instead of navigating. */
  exportData?: boolean;
};

const EVERY_ROLE: readonly AppRole[] = ["admin", "planner", "salesperson", "woodworker"];
const SHOP_OPS: readonly AppRole[] = ["admin", "planner"];
const SALES_AND_PLANNING: readonly AppRole[] = ["admin", "planner", "salesperson"];
const ADMIN_ONLY: readonly AppRole[] = ["admin"];

/**
 * MASTER MENU — the full, canonical shape everyone sees (filtered by role).
 * Order is intentional: top-to-bottom is rough daily frequency of use.
 */
export const MASTER_MENU: readonly MenuItem[] = [
  // ── Work: what you do every day ──────────────────────────────────────
  { href: "/today",        label: "My Day",       visible: true, order: 0,  group: "Work",   roles: EVERY_ROLE },
  { href: "/",             label: "Projects",     visible: true, order: 1,  group: "Work",   roles: SALES_AND_PLANNING },
  {
    href: "/projects/new",
    label: "New project",
    // Salespeople live in quote-world by default — calling it a "project"
    // before any commitment is what was confusing them. Same destination,
    // role-appropriate language.
    roleLabels: { salesperson: "New quote" },
    visible: true, order: 2, group: "Work", roles: SALES_AND_PLANNING,
  },
  { href: "/service-calls",label: "Service Calls",visible: true, order: 3,  group: "Work",   roles: SALES_AND_PLANNING },
  { href: "/calendar",     label: "Calendar",     visible: true, order: 4,  group: "Work",   roles: EVERY_ROLE },

  // ── Ops: running the shop ────────────────────────────────────────────
  { href: "/home",         label: "Cockpit",      visible: true, order: 10, group: "Ops",    roles: SHOP_OPS },
  { href: "/dashboard",    label: "Dashboard",    visible: true, order: 11, group: "Ops",    roles: SHOP_OPS },
  { href: "/inventory",    label: "Inventory",    visible: true, order: 12, group: "Ops",    roles: SHOP_OPS },
  { href: "/distributors", label: "Purchasing",   visible: true, order: 13, group: "Ops",    roles: SALES_AND_PLANNING },
  { href: "/costing",      label: "Costing",      visible: true, order: 14, group: "Ops",    roles: SALES_AND_PLANNING },

  // ── Tools: cross-cutting helpers ─────────────────────────────────────
  { href: "/assistant",    label: "Afaqi",        visible: true, order: 20, group: "Tools",  roles: EVERY_ROLE },
  { href: "/processes",    label: "Processes",    visible: true, order: 21, group: "Tools",  roles: SHOP_OPS },

  // ── Config: admin surface ────────────────────────────────────────────
  { href: "/admin",        label: "Admin Hub",    visible: true, order: 30, group: "Config", roles: ADMIN_ONLY },
  { href: "/admin/invites",label: "Invite People",visible: true, order: 31, group: "Config", roles: ADMIN_ONLY },
  { href: "#export",       label: "Export Backup",visible: true, order: 32, group: "Config", roles: ADMIN_ONLY, exportData: true },
];

/**
 * Resolve the visible label for a menu item given the viewer's role. Falls
 * back to the default `item.label` when no override exists for that role.
 */
export function getMenuLabelForRole(item: MenuItem, role: string): string {
  const override = item.roleLabels?.[role as AppRole];
  return override ?? item.label;
}

/** True if this role should see this item. */
export function isMenuItemVisibleToRole(item: MenuItem, role: string): boolean {
  if (!item.visible) return false;
  if (item.roles === "*") return true;
  return (item.roles as readonly string[]).includes(role);
}

/** Sub-paths of main routes that should still be considered "inside" a page. */
const DYNAMIC_PREFIXES: Record<string, readonly string[]> = {
  "/": ["/projects/"],
  "/calendar": ["/projects/"], // project detail reachable from calendar
  "/processes": ["/processes/"],
  "/admin": ["/admin/"],
};

/**
 * Is this pathname accessible to this role? Used by middleware + layouts.
 */
export function isPathAllowedForRole(pathname: string, role: string): boolean {
  // Derived roots from MASTER_MENU (so we don't duplicate knowledge).
  const allowedRoots = MASTER_MENU
    .filter((m) => isMenuItemVisibleToRole(m, role))
    .map((m) => m.href)
    .filter((h) => h.startsWith("/"));

  // Exact match
  if (allowedRoots.includes(pathname)) return true;

  // Dynamic children — e.g. /projects/abc is allowed if "/" is allowed.
  for (const [root, prefixes] of Object.entries(DYNAMIC_PREFIXES)) {
    if (!allowedRoots.includes(root)) continue;
    if (prefixes.some((p) => pathname.startsWith(p))) return true;
  }

  // Punch kiosk is a shared station surface (QR code endpoints).
  if (pathname.startsWith("/punch/")) return true;

  // Onboarding + auth scaffolding always reachable.
  if (pathname === "/onboarding" || pathname.startsWith("/auth")) return true;

  return false;
}
