import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";

export type AuditAction =
  | "created"
  | "saved"
  | "marked_done"
  | "readiness_blocked"
  | "material_shortage_blocked"
  | "material_shortage_unblocked"
  | "client_updated"
  | "cost_added"
  | "cost_updated"
  | "cost_deleted"
  | "settings_updated"
  | "vanity_updated"
  | "side_unit_updated"
  | "kitchen_updated"
  | "service_call_updated"
  | "duplicated"
  | "deleted"
  // Sales lifecycle transitions — see lib/projectLifecycle.ts and
  // /api/projects/[id]/lifecycle/route.ts. Each has its own action so the
  // audit log reads plainly ("Lost — client went elsewhere") without the
  // reviewer having to parse a generic "updated".
  | "lifecycle_archived"
  | "lifecycle_unarchived"
  | "lifecycle_lost"
  | "lifecycle_found";

export async function logAudit(
  projectId: string,
  action: AuditAction,
  details?: string | null
): Promise<void> {
  try {
    // Best-effort attribution: embed actor + impersonation metadata in details.
    // AuditLog schema is intentionally minimal; storing structured JSON here keeps migrations lightweight.
    let enrichedDetails: string | null = details ?? null;
    try {
      const session = await getSessionWithUser();
      if (session.ok) {
        const meta = {
          actorUserId: session.dbUser.id,
          actorEmail: session.dbUser.email,
          realRole: session.realRole,
          effectiveRole: session.effectiveRole,
          impersonation: session.impersonation,
        };
        const base =
          enrichedDetails && enrichedDetails.trim().length > 0
            ? { details: enrichedDetails }
            : {};
        enrichedDetails = JSON.stringify({ ...base, meta });
      }
    } catch {
      // ignore
    }

    await prisma.auditLog.create({
      data: { projectId, action, details: enrichedDetails },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
