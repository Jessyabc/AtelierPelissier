import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, withProjectAuth } from "@/lib/auth/guard";

/**
 * GET: List all service calls for the project, ordered by serviceDate ascending.
 * Any authenticated user — sales see service calls on their projects.
 */
export const GET = withAuth<{ id: string }>("any", async ({ params }) => {
  const { id: projectId } = params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, jobNumber: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const serviceCalls = await prisma.serviceCall.findMany({
    where: { projectId },
    include: { items: { include: { files: true } } },
    orderBy: { serviceDate: { sort: "asc", nulls: "last" } },
  });

  return NextResponse.json(serviceCalls);
});

/**
 * POST: Create a new service call for the project.
 * Auto-assigns serviceCallNumber as "{jobNumber} - #{n}".
 * Sales-touchable — sales book service calls for their clients.
 */
export const POST = withProjectAuth<{ id: string }>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
  const { id: projectId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, jobNumber: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const jobNumber = (project.jobNumber ?? "").trim();
  if (!jobNumber) {
    return NextResponse.json(
      { error: "Project must have a job number before adding service calls. Set it in the Client tab." },
      { status: 400 }
    );
  }

  // Count existing service calls for this project to get next #
  const count = await prisma.serviceCall.count({ where: { projectId } });
  const nextNumber = count + 1;
  const serviceCallNumber = `${jobNumber} - #${nextNumber}`;

  const data = body as Record<string, unknown>;
  const serviceCallData: Record<string, unknown> = {
    projectId,
    serviceCallNumber,
    clientName: data.clientName ?? null,
    jobNumber: project.jobNumber,
    address: data.address ?? null,
    contactPerson: data.contactPerson ?? null,
    clientPhone: data.clientPhone ?? null,
    clientEmail: data.clientEmail ?? null,
    serviceDate: data.serviceDate ?? null,
    timeOfArrival: data.timeOfArrival ?? null,
    timeOfDeparture: data.timeOfDeparture ?? null,
    technicianName: data.technicianName ?? null,
    serviceCallType: data.serviceCallType ?? null,
    reasonForService: data.reasonForService ?? null,
    workPerformed: data.workPerformed ?? null,
    checklistJson: data.checklistJson ?? null,
    materialsDescription: data.materialsDescription ?? null,
    materialsQuantity: data.materialsQuantity ?? null,
    materialsProvidedBy: data.materialsProvidedBy ?? null,
    serviceCompleted: data.serviceCompleted ?? null,
    additionalVisitRequired: data.additionalVisitRequired ?? null,
    additionalVisitReason: data.additionalVisitReason ?? null,
    estimatedFollowUpDate: data.estimatedFollowUpDate ?? null,
    satisfactionJson: data.satisfactionJson ?? null,
    clientAcknowledgmentType: data.clientAcknowledgmentType ?? null,
    followUpReason: data.followUpReason ?? null,
    clientSignature: data.clientSignature ?? null,
    responsibleSignature: data.responsibleSignature ?? null,
    notes: data.notes ?? null,
  };

  const serviceCall = await prisma.serviceCall.create({
    data: serviceCallData as Parameters<typeof prisma.serviceCall.create>[0]["data"],
    include: { items: true },
  });

  const items = (data.items as Array<{ description: string; quantity?: string | null; providedBy?: string | null }>) ?? [];
  for (const item of items) {
    if (item?.description?.trim()) {
      await prisma.serviceCallItem.create({
        data: {
          serviceCallId: serviceCall.id,
          description: item.description.trim(),
          quantity: item.quantity ?? null,
          providedBy: item.providedBy ?? null,
        },
      });
    }
  }

  const full = await prisma.serviceCall.findUnique({
    where: { id: serviceCall.id },
    include: { items: { include: { files: true } } },
  });

  return NextResponse.json(full);
  }
);
