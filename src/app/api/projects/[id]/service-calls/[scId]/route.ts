import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { serviceCallSchema } from "@/lib/validators";
import { withAuth, withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; scId: string };

/**
 * GET: Fetch a single service call. Any authenticated user.
 */
export const GET = withAuth<Params>("any", async ({ params }) => {
  const { id: projectId, scId } = params;

  const serviceCall = await prisma.serviceCall.findFirst({
    where: { id: scId, projectId },
    include: { items: { include: { files: true } } },
  });
  if (!serviceCall) {
    return NextResponse.json({ error: "Service call not found" }, { status: 404 });
  }
  return NextResponse.json(serviceCall);
});

/**
 * PATCH: Update a service call. serviceCallNumber is read-only (auto-generated).
 * Sales-touchable — they manage their own service calls.
 */
export const PATCH = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
    const { id: projectId, scId } = params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = serviceCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceCall.findFirst({
      where: { id: scId, projectId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Service call not found" }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== "serviceCallNumber" && v !== undefined) {
        updateData[k] = v;
      }
    }

    const serviceCall = await prisma.serviceCall.update({
      where: { id: scId },
      data: updateData,
      include: { items: { include: { files: true } } },
    });

    await logAudit(projectId, "service_call_updated");
    return NextResponse.json(serviceCall);
  }
);
