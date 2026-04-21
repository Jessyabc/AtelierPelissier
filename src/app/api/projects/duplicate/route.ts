import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withAuth, checkProjectAccess } from "@/lib/auth/guard";

// POST /api/projects/duplicate
// Top-level (no project [id] path param) so role gating is done with `withAuth`.
// Project-scope is enforced per-body: the caller must be tied to the SOURCE
// project they are cloning (prevents a salesperson from cloning a colleague's
// confidential quote into a new draft under their own name).
export const POST = withAuth(["admin", "planner", "salesperson"], async ({ req, session }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sourceId = typeof body === "object" && body !== null && "sourceId" in body ? (body as { sourceId: string }).sourceId : null;
  if (!sourceId || typeof sourceId !== "string") {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  // Project-scope check on the source project — prevents unauthorized copies.
  const sourceAccess = await checkProjectAccess(session, sourceId);
  if (!sourceAccess.ok) return sourceAccess.response;

  const source = await prisma.project.findUnique({
    where: { id: sourceId },
    include: {
      projectSettings: { include: { sheetFormat: true } },
      vanityInputs: true,
      sideUnitInputs: true,
      kitchenInputs: true,
      kitchenPricingProject: {
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
      },
      panelParts: true,
      prerequisiteLines: true,
      costLines: true,
      taskItems: { orderBy: { sortOrder: "asc" } },
      serviceCalls: { include: { items: true }, orderBy: { serviceDate: "asc" } },
      projectItems: { include: { taskItems: true, cutlists: true }, orderBy: { sortOrder: "asc" } },
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
        processTemplateId: source.processTemplateId,
        clientId: source.clientId,
        client2Id: source.client2Id,
        clientFirstName: source.clientFirstName,
        clientLastName: source.clientLastName,
        clientEmail: source.clientEmail,
        clientPhone: source.clientPhone,
        clientPhone2: source.clientPhone2,
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

    for (const ti of source.taskItems) {
      await prisma.projectTaskItem.create({
        data: {
          projectId: project.id,
          label: ti.label,
          isDone: false,
          sortOrder: ti.sortOrder,
        },
      });
    }

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
    if (source.kitchenPricingProject) {
      const copiedKitchen = await prisma.kitchenPricingProject.create({
        data: {
          projectId: project.id,
          includeInstallation: source.kitchenPricingProject.includeInstallation,
          includeDelivery: source.kitchenPricingProject.includeDelivery,
          deliveryCost: source.kitchenPricingProject.deliveryCost,
          multiplier: source.kitchenPricingProject.multiplier,
          discountPercent: source.kitchenPricingProject.discountPercent,
          discountReason: source.kitchenPricingProject.discountReason,
          approvalStatus: "not_required",
          approvalReason: null,
          approvedByRole: null,
          submittedByRole: null,
          submittedAt: null,
          approvedAt: null,
        },
      });

      for (const cabinet of source.kitchenPricingProject.cabinets) {
        const copiedCabinet = await prisma.kitchenPricingCabinet.create({
          data: {
            kitchenPricingProjectId: copiedKitchen.id,
            sortOrder: cabinet.sortOrder,
            cabinetType: cabinet.cabinetType,
            configuration: cabinet.configuration,
            cabinetBoxMaterialId: cabinet.cabinetBoxMaterialId,
            cabinetBoxQuantity: cabinet.cabinetBoxQuantity,
            manualFabricationHours: cabinet.manualFabricationHours,
          },
        });

        if (cabinet.doorSpecs.length > 0) {
          await prisma.kitchenPricingDoorSpec.createMany({
            data: cabinet.doorSpecs.map((door) => ({
              kitchenPricingCabinetId: copiedCabinet.id,
              sortOrder: door.sortOrder,
              widthInches: door.widthInches,
              heightInches: door.heightInches,
              quantity: door.quantity,
              manufacturerId: door.manufacturerId,
              styleId: door.styleId,
            })),
          });
        }

        if (cabinet.drawerSpecs.length > 0) {
          await prisma.kitchenPricingDrawerSpec.createMany({
            data: cabinet.drawerSpecs.map((drawer) => ({
              kitchenPricingCabinetId: copiedCabinet.id,
              sortOrder: drawer.sortOrder,
              drawerSystemId: drawer.drawerSystemId,
              quantity: drawer.quantity,
            })),
          });
        }

        if (cabinet.hardware) {
          await prisma.kitchenPricingHardware.create({
            data: {
              kitchenPricingCabinetId: copiedCabinet.id,
              standardHinges: cabinet.hardware.standardHinges,
              verticalHinges: cabinet.hardware.verticalHinges,
              handleTypeId: cabinet.hardware.handleTypeId,
              handleQuantity: cabinet.hardware.handleQuantity,
              pattes: cabinet.hardware.pattes,
              ledQuantity: cabinet.hardware.ledQuantity,
              wasteBinQuantity: cabinet.hardware.wasteBinQuantity,
            },
          });
        }
      }

      if (source.kitchenPricingProject.installationItems.length > 0) {
        await prisma.kitchenPricingInstallationItem.createMany({
          data: source.kitchenPricingProject.installationItems.map((item) => ({
            kitchenPricingProjectId: copiedKitchen.id,
            installTypeId: item.installTypeId,
            quantity: item.quantity,
          })),
        });
      }
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

    // Copy project items (deliverables), their cutlists, and task items
    const oldCutlistIdToNew: Record<string, string> = {};
    if (!source.parentProjectId && source.projectItems?.length) {
      for (const pi of source.projectItems) {
        const newItem = await prisma.projectItem.create({
          data: {
            projectId: project.id,
            type: pi.type,
            label: pi.label,
            processTemplateId: pi.processTemplateId,
            sortOrder: pi.sortOrder,
          },
        });
        for (const task of pi.taskItems) {
          await prisma.projectItemTaskItem.create({
            data: {
              projectItemId: newItem.id,
              label: task.label,
              isDone: false,
              sortOrder: task.sortOrder,
            },
          });
        }
        for (const cut of pi.cutlists ?? []) {
          const newCut = await prisma.cutlist.create({
            data: {
              projectItemId: newItem.id,
              name: cut.name,
              sortOrder: cut.sortOrder,
            },
          });
          oldCutlistIdToNew[cut.id] = newCut.id;
        }
      }
    }

    // Copy panel parts with cutlistId mapping
    for (const part of source.panelParts) {
      await prisma.panelPart.create({
        data: {
          projectId: project.id,
          cutlistId: part.cutlistId ? (oldCutlistIdToNew[part.cutlistId] ?? null) : null,
          label: part.label,
          lengthIn: part.lengthIn,
          widthIn: part.widthIn,
          qty: part.qty,
          materialCode: part.materialCode,
          thicknessIn: part.thicknessIn,
        },
      });
    }

    // Copy prerequisite lines
    for (const line of source.prerequisiteLines) {
      await prisma.prerequisiteLine.create({
        data: {
          projectId: project.id,
          materialCode: line.materialCode,
          category: line.category,
          quantity: line.quantity,
          needed: line.needed,
          sortOrder: line.sortOrder,
        },
      });
    }

    await logAudit(project.id, "duplicated", `From: ${source.name}`);
    const full = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        kitchenPricingProject: {
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
        },
        panelParts: true,
        costLines: true,
        serviceCalls: { include: { items: true } },
        projectItems: { include: { taskItems: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(full);
  } catch (err) {
    console.error("POST /api/projects/duplicate error:", err);
    return NextResponse.json({ error: "Failed to duplicate project" }, { status: 500 });
  }
});
