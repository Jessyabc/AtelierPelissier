/**
 * Material Snapshot API
 * GET  — return active snapshot + stale status for a sourceType
 * POST — compute ingredients, save snapshot, trigger recalc
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import { computeVanityIngredients } from "@/lib/ingredients/vanity";
import { computeSideUnitIngredients } from "@/lib/ingredients/sideUnit";
import { computeConfigHash } from "@/lib/ingredients/types";
import { saveSnapshot, getActiveSnapshot } from "@/lib/ingredients/snapshot";
import type { VanitySection, SideUnitSection } from "@/lib/ingredients/types";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";
import { withAuth, withProjectAuth } from "@/lib/auth/guard";

export const GET = withAuth<{ id: string }>("any", async ({ req, params }) => {
  const { id: projectId } = params;
  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get("sourceType") ?? "vanity";

  const snapshot = await getActiveSnapshot(
    projectId,
    sourceType as "vanity" | "side_unit"
  );

  if (!snapshot) {
    return NextResponse.json({ snapshot: null });
  }

  return NextResponse.json({ snapshot });
});

// Snapshot POST is triggered by the atomic Save in VanityTab / SideUnitTab,
// which salespeople use for quote-stage configuration. Project scope is
// required for non-admin/planner callers.
export const POST = withProjectAuth<{ id: string }>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
  const { id: projectId } = params;
  let body: { sourceType: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceType = body.sourceType as "vanity" | "side_unit";
  if (!["vanity", "side_unit"].includes(sourceType)) {
    return NextResponse.json(
      { error: "sourceType must be vanity or side_unit" },
      { status: 400 }
    );
  }

  const standards = await getConstructionStandards();

  if (sourceType === "vanity") {
    const vanityInputs = await prisma.vanityInputs.findUnique({
      where: { projectId },
    });
    if (!vanityInputs) {
      return NextResponse.json(
        { error: "No vanity inputs found for this project" },
        { status: 404 }
      );
    }

    const sections: VanitySection[] | null = vanityInputs.sections
      ? JSON.parse(vanityInputs.sections)
      : null;

    const estimate = computeVanityIngredients(
      {
        width: vanityInputs.width,
        depth: vanityInputs.depth,
        height: vanityInputs.height,
        kickplate: vanityInputs.kickplate,
        framingStyle: vanityInputs.framingStyle as "Sides only" | "Sides and bottom" | "Around" | "Frame everything",
        mountingStyle: vanityInputs.mountingStyle as "Freestanding" | "Wall-hung" | "Custom legs" | "Box base",
        drawers: vanityInputs.drawers,
        doors: vanityInputs.doors,
        thickFrame: vanityInputs.thickFrame,
        numberOfSinks: vanityInputs.numberOfSinks as "Single" | "Double",
        doorStyle: vanityInputs.doorStyle as "Slab/Flat" | "Thin Shaker" | "Standard Shaker",
        sections,
      },
      { standards }
    );

    const configHash = computeConfigHash(
      vanityInputs as unknown as Record<string, unknown>
    );

    const { snapshotId } = await saveSnapshot(
      projectId,
      "vanity",
      estimate,
      configHash,
      body.userId
    );

    // Trigger recalc (fire-and-forget). We call the function directly rather
    // than HTTP-fetching our own /recalculate endpoint — that required
    // forwarding the session cookie and would 403 for non-admin callers.
    recalculateProjectState(projectId).catch(() => {});

    return NextResponse.json({ snapshotId, estimate });
  }

  // side_unit
  const sideUnitInputs = await prisma.sideUnitInputs.findUnique({
    where: { projectId },
  });
  if (!sideUnitInputs) {
    return NextResponse.json(
      { error: "No side unit inputs found for this project" },
      { status: 404 }
    );
  }

  const sections: SideUnitSection[] | null = sideUnitInputs.sections
    ? JSON.parse(sideUnitInputs.sections)
    : null;

  const estimate = computeSideUnitIngredients(
    {
      width: sideUnitInputs.width,
      depth: sideUnitInputs.depth,
      height: sideUnitInputs.height,
      kickplate: sideUnitInputs.kickplate,
      framingStyle: sideUnitInputs.framingStyle as "Sides only" | "Sides and bottom" | "Around" | "Frame everything",
      mountingStyle: sideUnitInputs.mountingStyle as "Freestanding" | "Wall-hung" | "Custom legs" | "Box base",
      drawers: sideUnitInputs.drawers,
      doors: sideUnitInputs.doors,
      thickFrame: sideUnitInputs.thickFrame,
      doorStyle: sideUnitInputs.doorStyle as "Slab/Flat" | "Thin Shaker" | "Standard Shaker",
      sections,
    },
    { standards }
  );

  const configHash = computeConfigHash(
    sideUnitInputs as unknown as Record<string, unknown>
  );

  const { snapshotId } = await saveSnapshot(
    projectId,
    "side_unit",
    estimate,
    configHash,
    body.userId
  );

  recalculateProjectState(projectId).catch(() => {});

  return NextResponse.json({ snapshotId, estimate });
  }
);
