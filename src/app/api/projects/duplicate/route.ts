import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sourceId = typeof body === "object" && body !== null && "sourceId" in body ? (body as { sourceId: string }).sourceId : null;
  if (!sourceId || typeof sourceId !== "string") {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const source = await prisma.project.findUnique({
    where: { id: sourceId },
    include: {
      projectSettings: { include: { sheetFormat: true } },
      vanityInputs: true,
      sideUnitInputs: true,
      kitchenInputs: true,
      panelParts: true,
      costLines: true,
      serviceCalls: { include: { items: true }, orderBy: { serviceDate: "asc" } },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const newName = `${source.name} (copy)`;
    const project = await prisma.project.create({
      data: {
        name: newName,
        type: source.type,
        types: source.types,
        isDraft: true,
        jobNumber: source.jobNumber ? `${source.jobNumber} (copy)` : null,
        notes: source.notes,
        clientFirstName: source.clientFirstName,
        clientLastName: source.clientLastName,
        clientEmail: source.clientEmail,
        clientPhone: source.clientPhone,
        clientAddress: source.clientAddress,
        projectSettings: {
          create: {
            markup: source.projectSettings?.markup ?? 2.5,
            taxEnabled: source.projectSettings?.taxEnabled ?? false,
            taxRate: source.projectSettings?.taxRate ?? 0.14975,
            sheetFormatId: source.projectSettings?.sheetFormatId ?? null,
          },
        },
      },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        costLines: true,
      },
    });

    if (source.vanityInputs) {
      const v = source.vanityInputs;
      await prisma.vanityInputs.create({
        data: {
          projectId: project.id,
          width: v.width,
          depth: v.depth,
          kickplate: v.kickplate,
          framingStyle: v.framingStyle,
          mountingStyle: v.mountingStyle,
          drawers: v.drawers,
          doors: v.doors,
          thickFrame: v.thickFrame,
          numberOfSinks: v.numberOfSinks,
          doorStyle: v.doorStyle,
          countertop: v.countertop,
          countertopWidth: v.countertopWidth,
          countertopDepth: v.countertopDepth,
          sinks: v.sinks,
          faucetHoles: v.faucetHoles,
          priceRangePi2: v.priceRangePi2,
        },
      });
    }
    if (source.sideUnitInputs) {
      const s = source.sideUnitInputs;
      await prisma.sideUnitInputs.create({
        data: {
          projectId: project.id,
          width: s.width,
          depth: s.depth,
          height: s.height,
          kickplate: s.kickplate,
          framingStyle: s.framingStyle,
          mountingStyle: s.mountingStyle,
          drawers: s.drawers,
          doors: s.doors,
          thickFrame: s.thickFrame,
          doorStyle: s.doorStyle,
        },
      });
    }
    if (source.kitchenInputs) {
      await prisma.kitchenInputs.create({
        data: { projectId: project.id },
      });
    }
    for (const part of source.panelParts) {
      await prisma.panelPart.create({
        data: {
          projectId: project.id,
          label: part.label,
          lengthIn: part.lengthIn,
          widthIn: part.widthIn,
          qty: part.qty,
          materialCode: part.materialCode,
          thicknessIn: part.thicknessIn,
        },
      });
    }
    for (const line of source.costLines) {
      await prisma.costLine.create({
        data: {
          projectId: project.id,
          kind: line.kind,
          category: line.category,
          amount: line.amount,
        },
      });
    }

    // Duplicate service calls (without signatures - those are specific to each visit)
    for (const src of source.serviceCalls) {
      const sc = await prisma.serviceCall.create({
        data: {
          projectId: project.id,
          clientName: src.clientName,
          jobNumber: src.jobNumber,
          address: src.address,
          contactPerson: src.contactPerson,
          clientPhone: src.clientPhone,
          clientEmail: src.clientEmail,
          serviceDate: src.serviceDate,
          timeOfArrival: src.timeOfArrival,
          timeOfDeparture: src.timeOfDeparture,
          technicianName: src.technicianName,
          serviceCallNumber: src.serviceCallNumber,
          serviceCallType: src.serviceCallType,
          reasonForService: src.reasonForService,
          workPerformed: src.workPerformed,
          checklistJson: src.checklistJson,
          materialsDescription: src.materialsDescription,
          materialsQuantity: src.materialsQuantity,
          materialsProvidedBy: src.materialsProvidedBy,
          serviceCompleted: src.serviceCompleted,
          additionalVisitRequired: src.additionalVisitRequired,
          additionalVisitReason: src.additionalVisitReason,
          estimatedFollowUpDate: src.estimatedFollowUpDate,
          satisfactionJson: src.satisfactionJson,
          clientAcknowledgmentType: src.clientAcknowledgmentType,
          followUpReason: src.followUpReason,
          notes: src.notes,
        },
      });
      for (const item of src.items) {
        await prisma.serviceCallItem.create({
          data: {
            serviceCallId: sc.id,
            description: item.description,
            quantity: item.quantity ?? null,
            providedBy: item.providedBy ?? null,
          },
        });
      }
    }

    await logAudit(project.id, "duplicated", `From: ${source.name}`);
    const full = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        costLines: true,
        serviceCalls: { include: { items: true } },
      },
    });
    return NextResponse.json(full);
  } catch (err) {
    console.error("POST /api/projects/duplicate error:", err);
    return NextResponse.json({ error: "Failed to duplicate project" }, { status: 500 });
  }
}
