import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { mapKitchenProjectToPayload } from "@/lib/kitchen-pricing/mappers";
import { requiresManagerReview } from "@/lib/kitchen-pricing/permissions";
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner", "salesperson"]);
  if (!auth.ok) return auth.response;
  const { id: projectId } = await params;

  const kitchenProject = await fetchKitchenProject(projectId);
  if (!kitchenProject) {
    return NextResponse.json(
      { error: "No kitchen builder data to submit." },
      { status: 400 }
    );
  }

  const payload = mapKitchenProjectToPayload(kitchenProject);
  const needsReview = requiresManagerReview(payload.multiplier);
  const now = new Date();

  if (auth.effectiveRole === "salesperson" && needsReview) {
    await prisma.$transaction(async (tx) =>
      saveKitchenBuilderState(tx, projectId, payload, {
        approvalStatus: "pending",
        submittedByRole: auth.effectiveRole,
        submittedAt: now,
      })
    );

    await logAudit(
      projectId,
      "kitchen_updated",
      JSON.stringify({ event: "builder_submit_pending_approval", multiplier: payload.multiplier })
    );

    return NextResponse.json(
      {
        ok: false,
        requiresApproval: true,
        approvalStatus: "pending",
        message: "Non-default multiplier requires planner/admin approval.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) =>
    saveKitchenBuilderState(tx, projectId, payload, {
      approvalStatus: "approved",
      submittedByRole: auth.effectiveRole,
      submittedAt: now,
      approvedByRole: auth.effectiveRole,
      approvedAt: now,
    })
  );

  await logAudit(
    projectId,
    "kitchen_updated",
    JSON.stringify({ event: "builder_submitted", multiplier: payload.multiplier, role: auth.effectiveRole })
  );

  return NextResponse.json({
    ok: true,
    approvalStatus: "approved",
    requiresApproval: false,
  });
}
