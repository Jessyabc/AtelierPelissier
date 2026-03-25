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
