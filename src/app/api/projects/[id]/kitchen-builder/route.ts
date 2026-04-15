import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { kitchenBuilderPayloadSchema } from "@/lib/validators";
import { calculateKitchenSalesBreakdown, calculateTotalCost } from "@/lib/kitchen-pricing/engine";
import { mapKitchenProjectToPayload } from "@/lib/kitchen-pricing/mappers";
import { canUserSeeBreakdown, requiresManagerReview } from "@/lib/kitchen-pricing/permissions";
import { saveKitchenBuilderState } from "@/lib/kitchen-pricing/persistence";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner", "salesperson"]);
  if (!auth.ok) return auth.response;
  const { id: projectId } = await params;

  const kitchenProject = await fetchKitchenProject(projectId);
  const payload = mapKitchenProjectToPayload(kitchenProject);
  const totals = calculateTotalCost(payload);
  const sales = calculateKitchenSalesBreakdown(payload);

  return NextResponse.json({
    payload,
    totals: canUserSeeBreakdown(auth.effectiveRole) ? totals : null,
    sales,
    visibility: {
      canSeeBreakdown: canUserSeeBreakdown(auth.effectiveRole),
      role: auth.effectiveRole,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner", "salesperson"]);
  if (!auth.ok) return auth.response;
  const { id: projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
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
    auth.effectiveRole === "salesperson" && needsReview ? "required" : undefined;

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
      role: auth.effectiveRole,
    })
  );

  return NextResponse.json({
    payload,
    totals: canUserSeeBreakdown(auth.effectiveRole) ? result.totals : null,
    sales: result.sales,
    approval: {
      status: statusOverride ?? "unchanged",
      requiresReview: needsReview,
    },
  });
}
