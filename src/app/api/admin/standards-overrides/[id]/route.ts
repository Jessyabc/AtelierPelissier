/**
 * Review (approve / reject) a standards override.
 *
 * PATCH — body: { status: "approved" | "rejected", reviewNote?: string }
 *
 *         Tier gate: enforced through `canApprove(role, tier)`. Planners may
 *         act on "low" rows; only admins may act on "high". Rejecting a
 *         pending row records the reviewer and note and leaves the row in
 *         place for audit. Approved/rejected rows are immutable — any further
 *         PATCH returns 409.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";
import { canApprove, type RiskTier } from "@/lib/standards/overridePolicy";

type Params = { id: string };

export const PATCH = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params, session }) => {
    const { id: overrideId } = params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;
    const nextStatus = raw.status;
    const reviewNote =
      typeof raw.reviewNote === "string" && raw.reviewNote.trim()
        ? raw.reviewNote.trim()
        : null;

    if (nextStatus !== "approved" && nextStatus !== "rejected") {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const row = await prisma.standardsOverride.findUnique({
      where: { id: overrideId },
      select: { id: true, status: true, riskTier: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { error: `Override is already ${row.status}; re-review is not allowed.` },
        { status: 409 }
      );
    }

    const tier = row.riskTier as RiskTier;
    if (!canApprove(session.effectiveRole, tier)) {
      return NextResponse.json(
        {
          error:
            tier === "high"
              ? "Admin review required for this override."
              : "Forbidden",
        },
        { status: 403 }
      );
    }

    const updated = await prisma.standardsOverride.update({
      where: { id: overrideId },
      data: {
        status: nextStatus,
        reviewedByUserId: session.dbUser.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    return NextResponse.json(updated);
  }
);
