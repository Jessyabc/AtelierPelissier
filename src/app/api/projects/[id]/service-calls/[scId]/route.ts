import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { serviceCallSchema } from "@/lib/validators";

/** GET: Fetch a single service call by ID (must belong to the project). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; scId: string }> }
) {
  const { id: projectId, scId } = await params;

  const serviceCall = await prisma.serviceCall.findFirst({
    where: { id: scId, projectId },
    include: { items: { include: { files: true } } },
  });
  if (!serviceCall) {
    return NextResponse.json({ error: "Service call not found" }, { status: 404 });
  }
  return NextResponse.json(serviceCall);
}

/** PATCH: Update a service call. serviceCallNumber is read-only (auto-generated). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scId: string }> }
) {
  const { id: projectId, scId } = await params;

  let body: unknown;
  try {
    body = await request.json();
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
      // Don't allow overwriting auto-generated serviceCallNumber
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
