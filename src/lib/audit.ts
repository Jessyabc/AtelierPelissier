import { prisma } from "@/lib/db";

export type AuditAction =
  | "created"
  | "saved"
  | "marked_done"
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
  | "deleted";

export async function logAudit(
  projectId: string,
  action: AuditAction,
  details?: string | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { projectId, action, details: details ?? null },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
