/**
 * Standards-override approval queue.
 *
 * GET — list overrides across all projects, filtered by role:
 *         admin   → sees every row (pending, approved, rejected)
 *         planner → sees low-tier rows only (their approval ceiling)
 *         others  → forbidden
 *
 *       Optional query params:
 *         ?status=pending|approved|rejected  (defaults to all)
 *         ?tier=low|high                      (defaults to all)
 *         ?projectId=<id>                     (scope to one project)
 *
 *       Each row is returned with a thin project summary so the admin UI
 *       can render "{project name} — {standard} {old} → {new}" without a
 *       second round-trip.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

export const GET = withAuth(["admin", "planner"], async ({ req, session }) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const tierParam = url.searchParams.get("tier");
  const projectIdParam = url.searchParams.get("projectId");

  const where: {
    status?: string;
    riskTier?: string;
    projectId?: string;
  } = {};

  if (statusParam && ["pending", "approved", "rejected"].includes(statusParam)) {
    where.status = statusParam;
  }
  if (tierParam && ["low", "high"].includes(tierParam)) {
    where.riskTier = tierParam;
  }
  if (projectIdParam) where.projectId = projectIdParam;

  // Planners cap at low-tier visibility — they can't approve high-risk
  // overrides, so surfacing them would be noise (and invite failed clicks).
  if (session.effectiveRole === "planner") {
    where.riskTier = "low";
  }

  const rows = await prisma.standardsOverride.findMany({
    where,
    include: {
      project: {
        select: { id: true, name: true, jobNumber: true, stage: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(rows);
});
