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
import { requireProjectAccess } from "@/lib/auth/guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get("sourceType") ?? "vanity";

  const snapshot = await getActiveSnapshot(
    projectId,
    sourceType as "vanity" | "side_unit"
  );

  if (!snapshot) {
    return NextResponse.json({ snapshot: null });
  }

  return NextResponse.json({ snapshot });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  let body: { sourceType: string; userId?: string };
  try {
    body = await request.json();
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

    // Trigger recalc (fire-and-forget)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/projects/${projectId}/recalculate`, {
        method: "POST",
      }).catch(() => {});
    } catch {
      // non-blocking
    }

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

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/projects/${projectId}/recalculate`, {
      method: "POST",
    }).catch(() => {});
  } catch {
    // non-blocking
  }

  return NextResponse.json({ snapshotId, estimate });
}
