/**
 * Standards-override requests scoped to a single project.
 *
 * GET  — list all override requests for this project (any status).
 *        Readable by any role with project access (admin, planner, owning
 *        salesperson). Planners triage these from the project page.
 *
 * POST — create a pending override request. Body:
 *          { standardKey, overrideValue, sectionId?, reason? }
 *        Server looks up the current canonical `standardValue` and the risk
 *        tier (via lib/standards/overridePolicy), then inserts a pending row.
 *        Sales / planner / admin may request. Approval happens elsewhere
 *        (see /api/admin/standards-overrides/[id]).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withProjectAuth } from "@/lib/auth/guard";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import { classifyOverride } from "@/lib/standards/overridePolicy";
import type { ConstructionStandardsData } from "@/lib/ingredients/types";

type Params = { id: string };

export const GET = withAuth<Params>("any", async ({ params }) => {
  const { id: projectId } = params;

  const exists = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const overrides = await prisma.standardsOverride.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(overrides);
});

export const POST = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ req, params, session }) => {
    const { id: projectId } = params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const standardKey = typeof raw.standardKey === "string" ? raw.standardKey.trim() : "";
    const overrideValue = typeof raw.overrideValue === "number" ? raw.overrideValue : NaN;
    const sectionId =
      typeof raw.sectionId === "string" && raw.sectionId.trim() ? raw.sectionId.trim() : null;
    const reason =
      typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : null;

    if (!standardKey) {
      return NextResponse.json({ error: "standardKey is required" }, { status: 400 });
    }
    if (!Number.isFinite(overrideValue)) {
      return NextResponse.json({ error: "overrideValue must be a number" }, { status: 400 });
    }

    // Look up the canonical standard value at request time. Captured so the
    // override record stays meaningful even if the admin tunes the standard
    // afterwards — the audit trail reads correctly either way.
    const standards = await getConstructionStandards();
    const canonical = standards[standardKey as keyof ConstructionStandardsData];
    if (typeof canonical !== "number") {
      return NextResponse.json(
        { error: `Unknown standardKey: ${standardKey}` },
        { status: 400 }
      );
    }

    // No-op guard — if the requested value equals the canonical, there's
    // nothing to review.
    if (canonical === overrideValue) {
      return NextResponse.json(
        { error: "Override value equals the canonical standard — nothing to request." },
        { status: 400 }
      );
    }

    const { tier } = classifyOverride(standardKey);

    const created = await prisma.standardsOverride.create({
      data: {
        projectId,
        standardKey,
        standardValue: canonical,
        overrideValue,
        sectionId,
        riskTier: tier,
        reason,
        status: "pending",
        requestedByUserId: session.dbUser.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  }
);
