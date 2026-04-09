import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

/**
 * Best-effort cleanup helper: deletes projects that were created during impersonation.
 * This relies on AuditLog `details` being JSON with `{ meta: { impersonation: ... } }`.
 *
 * Why only projects? Projects cascade-delete a lot of related entities in Prisma schema,
 * making cleanup safer than trying to delete many tables independently.
 */
export async function POST(req: Request) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(200, body.limit) : 50;

  // Find recent "created" audit logs with impersonation meta attached.
  const rows = await prisma.auditLog.findMany({
    where: { action: "created" },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const projectIds: string[] = [];
  for (const r of rows) {
    if (projectIds.length >= limit) break;
    const d = r.details ?? "";
    if (!d || d[0] !== "{") continue;
    try {
      const parsed = JSON.parse(d) as any;
      const imp = parsed?.meta?.impersonation;
      if (imp && typeof imp.role === "string") {
        projectIds.push(r.projectId);
      }
    } catch {
      // ignore non-JSON details
    }
  }

  const unique = Array.from(new Set(projectIds));
  if (unique.length === 0) {
    return NextResponse.json({ ok: true, deletedProjects: 0 });
  }

  // Delete projects (cascades to most related data).
  const result = await prisma.project.deleteMany({
    where: { id: { in: unique } },
  });

  return NextResponse.json({ ok: true, deletedProjects: result.count });
}

