/**
 * Auto-archive sweep for stale quotes.
 *
 * Finds every non-archived `quote` whose `lastSalesActivityAt` (or
 * `updatedAt` fallback) is older than the archive threshold and stamps
 * `archivedAt = now`, `archiveReason = "auto_stale"`. Draft projects
 * (invoiced, no deposit) are NEVER swept — see `shouldAutoArchive` in
 * lib/projectLifecycle.ts for the rationale: an issued invoice sitting
 * dormant is money left on the table and must be resolved by a human.
 *
 * POST /api/admin/archive-stale-quotes
 *   - Admin or planner only
 *   - Optional body: { dryRun?: boolean, asOf?: string (ISO) }
 *       dryRun=true → returns the candidates without writing
 *       asOf       → pins "now" (useful for testing and catch-up runs)
 *
 * Designed to be idempotent and cron-safe: running it twice produces
 * the same result as running it once.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import {
  shouldAutoArchive,
  thresholdsFromStandards,
  type FollowUpThresholds,
} from "@/lib/projectLifecycle";
import { logAudit } from "@/lib/audit";

export const POST = withAuth(["admin", "planner"], async ({ req }) => {
  let body: { dryRun?: unknown; asOf?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — defaults apply.
  }

  const dryRun = body.dryRun === true;
  const asOf =
    typeof body.asOf === "string" && body.asOf.trim() ? new Date(body.asOf) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "asOf must be a valid ISO date" }, { status: 400 });
  }

  const standards = await getConstructionStandards();
  const thresholds: FollowUpThresholds = thresholdsFromStandards(standards);

  // Narrow the DB scan to the only rows that can possibly auto-archive:
  // open quotes that aren't already archived or lost. The precise staleness
  // check runs in JS so the thresholds stay centralised in lib/projectLifecycle.
  const candidates = await prisma.project.findMany({
    where: {
      stage: "quote",
      isDone: false,
      archivedAt: null,
      lostReason: null,
      parentProjectId: null,
    },
    select: {
      id: true,
      name: true,
      jobNumber: true,
      stage: true,
      isDraft: true,
      isDone: true,
      depositReceivedAt: true,
      archivedAt: true,
      lostReason: true,
      updatedAt: true,
      lastSalesActivityAt: true,
    },
  });

  const toArchive = candidates.filter((p) => shouldAutoArchive(p, asOf, thresholds));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      asOf: asOf.toISOString(),
      thresholds,
      candidateCount: candidates.length,
      toArchiveCount: toArchive.length,
      toArchive: toArchive.map((p) => ({
        id: p.id,
        name: p.name,
        jobNumber: p.jobNumber,
        lastSalesActivityAt: p.lastSalesActivityAt ?? p.updatedAt,
      })),
    });
  }

  // Batch-update in one query for efficiency; audit-log each individually
  // so the trail reads row-by-row.
  const ids = toArchive.map((p) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({
      archivedCount: 0,
      asOf: asOf.toISOString(),
      thresholds,
    });
  }

  await prisma.project.updateMany({
    where: { id: { in: ids } },
    data: { archivedAt: asOf, archiveReason: "auto_stale" },
  });

  // Best-effort audit; failures here shouldn't undo the archive itself.
  await Promise.allSettled(
    ids.map((id) => logAudit(id, "lifecycle_archived", "auto_stale sweep"))
  );

  return NextResponse.json({
    archivedCount: ids.length,
    asOf: asOf.toISOString(),
    thresholds,
    archivedIds: ids,
  });
});
