import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createServiceCallSchema } from "@/lib/validators";

export const dynamic = "force-dynamic"; // Always return fresh list (no cache)

/**
 * GET: List ALL service calls across all projects.
 * Includes service calls created via standalone form and via project ServiceCallsTab.
 * Ordered by service date (most recent first), null dates last.
 */
export async function GET() {
  const serviceCalls = await prisma.serviceCall.findMany({
    // No where clause — return every service call in the system
    include: {
      project: {
        select: { id: true, name: true, jobNumber: true, clientFirstName: true, clientLastName: true },
      },
      items: { include: { files: true } },
    },
    orderBy: [
      { serviceDate: { sort: "desc", nulls: "last" } },
      { timeOfArrival: { sort: "desc", nulls: "last" } },
    ],
  });

  const list = serviceCalls.map((sc) => ({
    id: sc.id,
    projectId: sc.projectId,
    projectName: sc.project.name,
    clientName: sc.clientName ?? ([sc.project.clientFirstName, sc.project.clientLastName].filter(Boolean).join(" ") || "—"),
    jobNumber: sc.jobNumber ?? sc.project.jobNumber,
    serviceCallNumber: sc.serviceCallNumber,
    serviceDate: sc.serviceDate,
    timeOfArrival: sc.timeOfArrival,
    timeOfDeparture: sc.timeOfDeparture,
    serviceCallType: sc.serviceCallType,
    address: sc.address,
    items: sc.items,
  }));

  return NextResponse.json(list, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

/**
 * POST: Create a standalone service call. Job number is required.
 * - If project with jobNumber exists: add service call to it (MC-6199 - #2, #3, ...)
 * - If not: create new project with jobNumber, then add service call #1
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createServiceCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const jobNumber = (data.jobNumber ?? "").trim();
  if (!jobNumber) {
    return NextResponse.json(
      { error: "Job number is required for service calls" },
      { status: 400 }
    );
  }

  const clientLabel = data.clientName?.trim() || "Unnamed";
  const dateStr = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  try {
    let project = await prisma.project.findFirst({
      where: { jobNumber },
      select: { id: true, jobNumber: true },
    });

    if (!project) {
      const projectName = `Service call — ${clientLabel} — ${dateStr}`;
      project = await prisma.project.create({
        data: {
          name: projectName,
          type: "vanity",
          types: "vanity",
          isDraft: false, // Standalone service call — no draft, saved from creation
          jobNumber,
          clientFirstName: data.clientName ? data.clientName.trim().split(/\s+/)[0] ?? null : null,
          clientLastName:
            data.clientName && data.clientName.trim().split(/\s+/).length > 1
              ? data.clientName.trim().split(/\s+/).slice(1).join(" ")
              : null,
          clientPhone: data.clientPhone ?? null,
          clientEmail: data.clientEmail ?? null,
          projectSettings: {
            create: { markup: 2.5, taxEnabled: false, taxRate: 0.14975 },
          },
        },
      });
      await logAudit(project.id, "created", `Service call project: ${jobNumber}`);
    }

    const count = await prisma.serviceCall.count({ where: { projectId: project.id } });
    const nextNumber = count + 1;
    const serviceCallNumber = `${jobNumber} - #${nextNumber}`;

    const serviceCall = await prisma.serviceCall.create({
      data: {
        projectId: project.id,
        clientName: data.clientName ?? null,
        jobNumber,
        address: data.address ?? null,
        contactPerson: data.contactPerson ?? null,
        clientPhone: data.clientPhone ?? null,
        clientEmail: data.clientEmail ?? null,
        serviceDate: data.serviceDate ?? null,
        timeOfArrival: data.timeOfArrival ?? null,
        timeOfDeparture: data.timeOfDeparture ?? null,
        technicianName: data.technicianName ?? null,
        serviceCallNumber,
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
      },
      include: { items: true },
    });

    for (const item of data.items) {
      await prisma.serviceCallItem.create({
        data: {
          serviceCallId: serviceCall.id,
          description: item.description,
          quantity: item.quantity ?? null,
          providedBy: item.providedBy ?? null,
        },
      });
    }

    await logAudit(project.id, "created", `Service call: ${serviceCallNumber}`);

    const full = await prisma.serviceCall.findUnique({
      where: { id: serviceCall.id },
      include: { items: true, project: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      projectId: project.id,
      projectName: (full as { project?: { name: string } })?.project?.name ?? "",
      serviceCall: full,
    });
  } catch (err) {
    console.error("POST /api/service-calls error:", err);
    return NextResponse.json(
      { error: "Failed to create service call" },
      { status: 500 }
    );
  }
}
