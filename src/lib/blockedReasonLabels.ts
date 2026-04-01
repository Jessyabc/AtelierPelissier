/** Human-readable labels for `Project.blockedReason` (P1-E2). */

const LABELS: Record<string, string> = {
  missing_material: "Missing material",
  waiting_cutlist: "Waiting on cutlist",
  waiting_approval: "Waiting on approval",
  supplier_delay: "Supplier delay",
  missing_info: "Missing information",
  change_order: "Change order",
};

export function blockedReasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  return LABELS[code] ?? code.replace(/_/g, " ");
}

/** Sort order for AI / dashboards (lower = higher urgency). */
export function blockedReasonSeverityRank(reason: string): number {
  const order: Record<string, number> = {
    missing_material: 0,
    supplier_delay: 1,
    waiting_cutlist: 2,
    waiting_approval: 3,
    missing_info: 4,
    change_order: 5,
  };
  return order[reason] ?? 10;
}
