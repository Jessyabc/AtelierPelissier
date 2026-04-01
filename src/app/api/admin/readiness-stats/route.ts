import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

/**
 * P1-004: Adoption metrics for publish readiness gate (strict rejections).
 */
export async function GET() {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const rows = await prisma.auditLog.findMany({
    where: {
      action: "readiness_blocked",
      createdAt: { gte: since },
    },
    select: { id: true, details: true, createdAt: true, projectId: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const fieldCounts: Record<string, number> = {};
  let parsed = 0;
  for (const r of rows) {
    if (!r.details) continue;
    try {
      const j = JSON.parse(r.details) as { missing?: string[] };
      const missing = j.missing;
      if (!Array.isArray(missing)) continue;
      parsed++;
      for (const f of missing) {
        fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
      }
    } catch {
      /* skip */
    }
  }

  const topMissingFields = Object.entries(fieldCounts)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    totalReadinessBlocked: rows.length,
    entriesWithParsedMissing: parsed,
    topMissingFields,
    recent: rows.slice(0, 50).map((x) => ({
      id: x.id,
      projectId: x.projectId,
      createdAt: x.createdAt,
      details: x.details,
    })),
  });
}
