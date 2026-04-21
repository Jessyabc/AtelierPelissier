import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { vanityInputsSchema } from "@/lib/validators";
import { computeConfigHash, type VanitySection } from "@/lib/ingredients/types";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import { markSnapshotStale } from "@/lib/ingredients/snapshot";
import { withProjectAuth } from "@/lib/auth/guard";

/**
 * Validate section widths against the configured minimum. We parse the
 * JSON-encoded sections string at the API boundary — the UI form is
 * allowed to hold transitory invalid states, but we refuse to persist
 * them so the cutlist math never sees widths narrower than the standard.
 */
function validateSectionWidths(
  sectionsJson: string | null | undefined,
  minSectionWidth: number
): { ok: true } | { ok: false; error: string } {
  if (!sectionsJson) return { ok: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(sectionsJson);
  } catch {
    return { ok: false, error: "Sections JSON is malformed." };
  }
  if (!Array.isArray(parsed)) return { ok: true };
  const offenders: string[] = [];
  for (const raw of parsed as Partial<VanitySection>[]) {
    const width = typeof raw?.width === "number" ? raw.width : NaN;
    if (!Number.isFinite(width) || width < minSectionWidth) {
      offenders.push(
        `Section ${raw?.id ?? "?"} is ${Number.isFinite(width) ? `${width}"` : "missing a width"}`
      );
    }
  }
  if (offenders.length === 0) return { ok: true };
  return {
    ok: false,
    error: `Section width must be at least ${minSectionWidth}" — ${offenders.join("; ")}.`,
  };
}

// Vanity inputs are a sales-facing surface (the section configurator).
// Salesperson must be tied to the project.
export const PATCH = withProjectAuth<{ id: string }>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
  const { id: projectId } = params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = vanityInputsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Section width minimum is soft in the UI but strict here. Reject
  // payloads where any section is narrower than the configured minimum
  // and explain to the user which section(s) failed.
  const standards = await getConstructionStandards();
  const minCheck = validateSectionWidths(
    data.sections ?? null,
    standards.minSectionWidth
  );
  if (!minCheck.ok) {
    return NextResponse.json(
      { error: minCheck.error, field: "sections" },
      { status: 400 }
    );
  }

  await prisma.vanityInputs.upsert({
    where: { projectId },
    create: {
      projectId,
      width: data.width,
      depth: data.depth,
      height: data.height ?? null,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      numberOfSinks: data.numberOfSinks,
      doorStyle: data.doorStyle,
      countertop: data.countertop,
      countertopWidth: data.countertop ? data.countertopWidth ?? null : null,
      countertopDepth: data.countertop ? data.countertopDepth ?? null : null,
      sinks: data.countertop ? data.sinks ?? null : null,
      faucetHoles: data.countertop ? data.faucetHoles ?? null : null,
      priceRangePi2: data.countertop ? data.priceRangePi2 ?? null : null,
      sections: data.sections ?? null,
    },
    update: {
      width: data.width,
      depth: data.depth,
      height: data.height ?? null,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      numberOfSinks: data.numberOfSinks,
      doorStyle: data.doorStyle,
      countertop: data.countertop,
      countertopWidth: data.countertop ? data.countertopWidth ?? null : null,
      countertopDepth: data.countertop ? data.countertopDepth ?? null : null,
      sinks: data.countertop ? data.sinks ?? null : null,
      faucetHoles: data.countertop ? data.faucetHoles ?? null : null,
      priceRangePi2: data.countertop ? data.priceRangePi2 ?? null : null,
      sections: data.sections ?? null,
    },
  });
  await logAudit(projectId, "vanity_updated");

  // Stale tracking: check if active snapshot's configHash differs from new config
  const newHash = computeConfigHash(data as Record<string, unknown>);
  const activeSnapshot = await prisma.materialSnapshot.findFirst({
    where: { projectId, sourceType: "vanity", isActive: true },
  });
  if (activeSnapshot && activeSnapshot.configHash !== newHash) {
    await markSnapshotStale(projectId, "vanity");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { vanityInputs: true },
  });
  return NextResponse.json(project?.vanityInputs ?? {});
  }
);
