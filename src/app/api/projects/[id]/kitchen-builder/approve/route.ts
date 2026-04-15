import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { kitchenBuilderApprovalSchema } from "@/lib/validators";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  const { id: projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
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

  const kitchenProject = await fetchKitchenProject(projectId);
  if (!kitchenProject) {
    return NextResponse.json(
      { error: "No kitchen builder data to approve." },
      { status: 400 }
    );
  }

  const payload = mapKitchenProjectToPayload(kitchenProject);
  const isApproved = parsed.data.status === "approved";
  const now = new Date();

  await prisma.$transaction(async (tx) =>
    saveKitchenBuilderState(tx, projectId, payload, {
      approvalStatus: parsed.data.status,
      approvalReason: parsed.data.reason ?? null,
      approvedByRole: auth.effectiveRole,
      approvedAt: now,
      ...(isApproved ? {} : { submittedByRole: kitchenProject.submittedByRole ?? null }),
    })
  );

  await logAudit(
    projectId,
    "kitchen_updated",
    JSON.stringify({
      event: isApproved ? "builder_approved" : "builder_rejected",
      role: auth.effectiveRole,
      reason: parsed.data.reason ?? null,
    })
  );

  return NextResponse.json({
    ok: true,
    status: parsed.data.status,
  });
}
