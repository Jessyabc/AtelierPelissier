/**
 * Publishing readiness (P1-E1): required fields before `isDraft` → false.
 * Minimum set: docs/IMPLEMENTATION_BOARD.md P1-001.
 */

export type ReadinessProjectSnapshot = {
  jobNumber?: string | null;
  clientId?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  targetDate?: Date | null;
  projectItemCount: number;
};

export function computeReadinessCheck(snapshot: ReadinessProjectSnapshot): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!(snapshot.jobNumber ?? "").trim()) {
    missing.push("jobNumber");
  }

  const clientId = (snapshot.clientId ?? "").trim();
  const first = (snapshot.clientFirstName ?? "").trim();
  const last = (snapshot.clientLastName ?? "").trim();
  const hasClient = Boolean(clientId) || (Boolean(first) && Boolean(last));
  if (!hasClient) {
    missing.push("client");
  }

  if (snapshot.targetDate == null) {
    missing.push("targetDate");
  }

  if (snapshot.projectItemCount < 1) {
    missing.push("projectItems");
  }

  return { ready: missing.length === 0, missing };
}
