import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withAuth } from "@/lib/auth/guard";
import { kitchenBuilderApprovalSchema } from "@/lib/validators";
import { getConstructionStandards } from "@/lib/ingredients/getConstructionStandards";
import { mapKitchenProjectToPayload } from "@/lib/kitchen-pricing/mappers";
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

// Admin/planner-only approval gate. Admin/planner short-circuit in
// `checkProjectAccess`, so we use `withAuth` directly (project scope adds
// no additional check for these roles).
export const POST = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ req, params, session }) => {
  const { id: projectId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = kitchenBuilderApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.status !== "approved" && parsed.data.status !== "rejected") {
    return NextResponse.json(
      { error: "Approval endpoint only accepts approved or rejected." },
      { status: 400 }
    );
  }

  const [kitchenProject, standards] = await Promise.all([
    fetchKitchenProject(projectId),
    getConstructionStandards(),
  ]);
  if (!kitchenProject) {
    return NextResponse.json(
      { error: "No kitchen builder data to approve." },
      { status: 400 }
    );
  }

  const payload = mapKitchenProjectToPayload(kitchenProject, standards);
  const isApproved = parsed.data.status === "approved";
  const now = new Date();

  await prisma.$transaction(async (tx) =>
    saveKitchenBuilderState(tx, projectId, payload, {
      approvalStatus: parsed.data.status,
      approvalReason: parsed.data.reason ?? null,
      approvedByRole: session.effectiveRole,
      approvedAt: now,
      ...(isApproved ? {} : { submittedByRole: kitchenProject.submittedByRole ?? null }),
    })
  );

  await logAudit(
    projectId,
    "kitchen_updated",
    JSON.stringify({
      event: isApproved ? "builder_approved" : "builder_rejected",
      role: session.effectiveRole,
      reason: parsed.data.reason ?? null,
    })
  );

  return NextResponse.json({
    ok: true,
    status: parsed.data.status,
  });
  }
);
