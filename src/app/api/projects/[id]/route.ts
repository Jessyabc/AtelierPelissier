import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { updateProjectSchema } from "@/lib/validators";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";
import { getOrderedStepLabels } from "@/lib/processTemplate";
import { computeReadinessCheck } from "@/lib/readiness";

function projectJsonResponse(body: unknown, readinessSoftBypass: string[] | null) {
  if (readinessSoftBypass?.length) {
    return NextResponse.json(
      {
        ...(body as Record<string, unknown>),
        readinessWarning: { code: "readiness_incomplete" as const, missing: readinessSoftBypass },
      },
      { headers: { "X-Readiness-Warning": "readiness_incomplete" } }
    );
  }
  return NextResponse.json(body);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        client2: true,
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        prerequisiteLines: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
        costLines: true,
        materialRequirements: true,
        deviations: { where: { resolved: false } },
        orders: { include: { lines: true } },
        parentProject: { select: { id: true, name: true, jobNumber: true } },
        taskItems: { select: { id: true, label: true, isDone: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
        processTemplate: { select: { id: true, name: true } },
        projectItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            processTemplate: { select: { id: true, name: true } },
            taskItems: { orderBy: { sortOrder: "asc" } },
            cutlists: { orderBy: { sortOrder: "asc" } },
          },
        },
        subProjects: {
          select: {
            id: true,
            name: true,
            isDone: true,
            isDraft: true,
            updatedAt: true,
            processTemplateId: true,
            processTemplate: { select: { id: true, name: true } },
            taskItems: { select: { id: true, label: true, isDone: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (err) {
    console.error("GET /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  let readinessSoftBypass: string[] | null = null;

  if (data.isDraft === false) {
    const pre = await prisma.project.findUnique({
      where: { id },
      select: {
        isDraft: true,
        jobNumber: true,
        clientId: true,
        clientFirstName: true,
        clientLastName: true,
        targetDate: true,
        _count: { select: { projectItems: true } },
      },
    });
    if (!pre) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (pre.isDraft) {
      const mergedTarget =
        data.targetDate !== undefined
          ? data.targetDate
            ? new Date(data.targetDate)
            : null
          : pre.targetDate;
      const { ready, missing } = computeReadinessCheck({
        jobNumber: data.jobNumber !== undefined ? data.jobNumber : pre.jobNumber,
        clientId: data.clientId !== undefined ? data.clientId : pre.clientId,
        clientFirstName: data.clientFirstName !== undefined ? data.clientFirstName : pre.clientFirstName,
        clientLastName: data.clientLastName !== undefined ? data.clientLastName : pre.clientLastName,
        targetDate: mergedTarget,
        projectItemCount: pre._count.projectItems,
      });
      if (!ready) {
        const strict = process.env.READINESS_GATE_STRICT === "true";
        if (strict) {
          await logAudit(id, "readiness_blocked", JSON.stringify({ missing }));
          return NextResponse.json({ error: "readiness_check_failed", missing }, { status: 400 });
        }
        readinessSoftBypass = missing;
      }
    }
  }

  const updateData: {
    name?: string;
    type?: string;
    types?: string;
    isDraft?: boolean;
    isDone?: boolean;
    jobNumber?: string | null;
    notes?: string | null;
    clientId?: string | null;
    clientFirstName?: string | null;
    clientLastName?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientPhone2?: string | null;
    clientAddress?: string | null;
    client2Id?: string | null;
    processTemplateId?: string | null;
    targetDate?: Date | null;
    sellingPrice?: number | null;
    blockedReason?: string | null;
  } = {};
  if (data.name != null) updateData.name = data.name;
  if (data.types != null) {
    updateData.types = data.types.join(",");
    updateData.type = data.types[0] ?? undefined;
  }
  if (data.isDraft != null) updateData.isDraft = data.isDraft;
  if (data.isDone != null) updateData.isDone = data.isDone;
  if (data.jobNumber !== undefined) updateData.jobNumber = data.jobNumber;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.clientFirstName !== undefined) updateData.clientFirstName = data.clientFirstName;
  if (data.clientLastName !== undefined) updateData.clientLastName = data.clientLastName;
  if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
  if (data.clientPhone !== undefined) updateData.clientPhone = data.clientPhone;
  if (data.clientPhone2 !== undefined) updateData.clientPhone2 = data.clientPhone2;
  if (data.clientAddress !== undefined) updateData.clientAddress = data.clientAddress;
  if (data.targetDate !== undefined) updateData.targetDate = data.targetDate ? new Date(data.targetDate as string) : null;
  if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.client2Id !== undefined) updateData.client2Id = data.client2Id;
  if (data.processTemplateId !== undefined) updateData.processTemplateId = data.processTemplateId;
  if (data.blockedReason !== undefined) updateData.blockedReason = data.blockedReason;

  // When linking primary client by ID, populate embedded from Client
  if (data.clientId) {
    const c = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (c) {
      updateData.clientFirstName = c.firstName;
      updateData.clientLastName = c.lastName;
      updateData.clientEmail = c.email;
      updateData.clientPhone = c.phone;
      updateData.clientPhone2 = c.phone2;
      updateData.clientAddress = c.address;
    }
  }

  // Fetch current project for client sync
  const current = await prisma.project.findUnique({
    where: { id },
    select: { clientId: true, client2Id: true },
  });

  // Sync primary client: when linked, update Client record to match embedded fields
  if (current?.clientId && (data.clientFirstName !== undefined || data.clientLastName !== undefined || data.clientEmail !== undefined || data.clientPhone !== undefined || data.clientPhone2 !== undefined || data.clientAddress !== undefined)) {
    const clientUpdate: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null; phone2?: string | null; address?: string | null } = {};
    if (data.clientFirstName !== undefined && data.clientFirstName?.trim()) clientUpdate.firstName = data.clientFirstName.trim();
    if (data.clientLastName !== undefined && data.clientLastName?.trim()) clientUpdate.lastName = data.clientLastName.trim();
    if (data.clientEmail !== undefined) clientUpdate.email = data.clientEmail?.trim() || null;
    if (data.clientPhone !== undefined) clientUpdate.phone = data.clientPhone?.trim() || null;
    if (data.clientPhone2 !== undefined) clientUpdate.phone2 = data.clientPhone2?.trim() || null;
    if (data.clientAddress !== undefined) clientUpdate.address = data.clientAddress?.trim() || null;
    if (Object.keys(clientUpdate).length > 0) {
      await prisma.client.update({
        where: { id: current.clientId },
        data: clientUpdate,
      });
    }
  }

  // Handle client 2: update existing, create new, or unlink
  if (current?.client2Id && data.client2) {
    await prisma.client.update({
      where: { id: current.client2Id },
      data: {
        firstName: data.client2.firstName,
        lastName: data.client2.lastName,
        email: data.client2.email || null,
        phone: data.client2.phone || null,
        phone2: data.client2.phone2 || null,
        address: data.client2.address || null,
      },
    });
  } else if (data.client2 && !data.client2Id) {
    const c = await prisma.client.create({
      data: {
        firstName: data.client2.firstName,
        lastName: data.client2.lastName,
        email: data.client2.email || null,
        phone: data.client2.phone || null,
        phone2: data.client2.phone2 || null,
        address: data.client2.address || null,
      },
    });
    updateData.client2Id = c.id;
  }

  if (Object.keys(updateData).length === 0) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        client2: true,
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        costLines: true,
        taskItems: { select: { id: true, label: true, isDone: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
        processTemplate: { select: { id: true, name: true } },
        projectItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            processTemplate: { select: { id: true, name: true } },
            taskItems: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return projectJsonResponse(project, readinessSoftBypass);
  }

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
    include: {
      client: true,
      client2: true,
      projectSettings: { include: { sheetFormat: true } },
      vanityInputs: true,
      sideUnitInputs: true,
      kitchenInputs: true,
      panelParts: true,
      costLines: true,
      taskItems: { select: { id: true, label: true, isDone: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      processTemplate: { select: { id: true, name: true } },
      projectItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          processTemplate: { select: { id: true, name: true } },
          taskItems: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  // When assigning process template and project has no task items, seed from template
  if (
    data.processTemplateId !== undefined &&
    data.processTemplateId &&
    project.taskItems.length === 0 &&
    !project.parentProjectId
  ) {
    const labels = await getOrderedStepLabels(data.processTemplateId);
    if (labels !== null) {
      for (let i = 0; i < labels.length; i++) {
        await prisma.projectTaskItem.create({
          data: { projectId: id, label: labels[i], sortOrder: i },
        });
      }
      const withItems = await prisma.project.findUnique({
        where: { id },
        include: {
          projectSettings: { include: { sheetFormat: true } },
          vanityInputs: true,
          sideUnitInputs: true,
          kitchenInputs: true,
          panelParts: true,
          costLines: true,
          taskItems: { select: { id: true, label: true, isDone: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
          processTemplate: { select: { id: true, name: true } },
          projectItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              processTemplate: { select: { id: true, name: true } },
              taskItems: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      });
      if (withItems) {
        if (data.isDraft === false) await logAudit(id, "saved");
        if (data.isDone === true) await logAudit(id, "marked_done");
        else if (
        data.clientFirstName !== undefined ||
        data.clientLastName !== undefined ||
        data.clientEmail !== undefined ||
        data.clientPhone !== undefined ||
        data.clientPhone2 !== undefined ||
        data.clientAddress !== undefined
        )
          await logAudit(id, "client_updated");
        recalculateProjectState(id).catch(() => {});
        return projectJsonResponse(withItems, readinessSoftBypass);
      }
    }
  }

  if (data.isDraft === false) await logAudit(id, "saved");
  if (data.isDone === true) await logAudit(id, "marked_done");
  else if (
        data.clientFirstName !== undefined ||
        data.clientLastName !== undefined ||
        data.clientEmail !== undefined ||
        data.clientPhone !== undefined ||
        data.clientPhone2 !== undefined ||
        data.clientAddress !== undefined
  )
    await logAudit(id, "client_updated");
  recalculateProjectState(id).catch(() => {});
  return projectJsonResponse(project, readinessSoftBypass);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await logAudit(id, "deleted");
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
