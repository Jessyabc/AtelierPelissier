import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withProjectAuth } from "@/lib/auth/guard";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import { kitchenBuilderPayloadSchema } from "@/lib/validators";
import { calculateKitchenSalesBreakdown, calculateTotalCost } from "@/lib/kitchen-pricing/engine";
import { mapKitchenProjectToPayload } from "@/lib/kitchen-pricing/mappers";
import { canUserSeeBreakdown, requiresManagerReview } from "@/lib/kitchen-pricing/permissions";
import { saveKitchenBuilderState } from "@/lib/kitchen-pricing/persistence";
import { kitchenRoomDefaultsFromStandards } from "@/lib/kitchen-pricing/roomDefaults";

async function fetchKitchenProject(projectId: string) {
  return prisma.kitchenPricingProject.findUnique({
    where: { projectId },
    include: {
      cabinets: {
        orderBy: { sortOrder: "asc" },
        include: {
          doorSpecs: { orderBy: { sortOrder: "asc" } },
          drawerSpecs: { orderBy: { sortOrder: "asc" } },
          hardware: true,
        },
      },
      installationItems: true,
    },
  });
}

export const GET = withProjectAuth<{ id: string }>(
  ["admin", "planner", "salesperson"],
  async ({ params, session }) => {
    const { id: projectId } = params;

    const [kitchenProject, standards] = await Promise.all([
      fetchKitchenProject(projectId),
      getConstructionStandards(),
    ]);
    const payload = mapKitchenProjectToPayload(kitchenProject, standards);
    const shopRoomDefaults = kitchenRoomDefaultsFromStandards(standards);
    const totals = calculateTotalCost(payload);
    const sales = calculateKitchenSalesBreakdown(payload);

    return NextResponse.json({
      payload,
      shopRoomDefaults,
      totals: canUserSeeBreakdown(session.effectiveRole) ? totals : null,
      sales,
      visibility: {
        canSeeBreakdown: canUserSeeBreakdown(session.effectiveRole),
        role: session.effectiveRole,
      },
      approval: kitchenProject
        ? {
            status: kitchenProject.approvalStatus,
            reason: kitchenProject.approvalReason,
            submittedAt: kitchenProject.submittedAt,
            submittedByRole: kitchenProject.submittedByRole,
            approvedAt: kitchenProject.approvedAt,
            approvedByRole: kitchenProject.approvedByRole,
          }
        : null,
    });
  }
);

export const PATCH = withProjectAuth<{ id: string }>(
  ["admin", "planner", "salesperson"],
  async ({ req, params, session }) => {
    const { id: projectId } = params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = kitchenBuilderPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const needsReview = requiresManagerReview(payload.multiplier);

    const statusOverride =
      session.effectiveRole === "salesperson" && needsReview ? "required" : undefined;

    const result = await prisma.$transaction(async (tx) =>
      saveKitchenBuilderState(tx, projectId, payload, {
        approvalStatus: statusOverride,
      })
    );

    await logAudit(
      projectId,
      "kitchen_updated",
      JSON.stringify({
        event: "builder_saved",
        multiplier: payload.multiplier,
        needsReview,
        role: session.effectiveRole,
      })
    );

    return NextResponse.json({
      payload,
      totals: canUserSeeBreakdown(session.effectiveRole) ? result.totals : null,
      sales: result.sales,
      approval: {
        status: statusOverride ?? "unchanged",
        requiresReview: needsReview,
      },
    });
  }
);
