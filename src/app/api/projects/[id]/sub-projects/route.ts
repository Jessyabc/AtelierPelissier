import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/**
 * POST: Create a sub-project under this project (e.g. B/O return visit).
 * Inherits client info and job number from parent.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: parentId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body as { name?: string; items?: string[]; processTemplateId?: string };
  const name = data?.name ? String(data.name).trim() || "Task" : "Task";
  const processTemplateId = data?.processTemplateId ? String(data.processTemplateId).trim() || null : null;
  const customItems = Array.isArray(data?.items)
    ? data.items.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const parent = await prisma.project.findUnique({
    where: { id: parentId },
    select: {
      type: true,
      types: true,
      jobNumber: true,
      clientFirstName: true,
      clientLastName: true,
      clientEmail: true,
      clientPhone: true,
      clientAddress: true,
    },
  });
  if (!parent) {
    return NextResponse.json({ error: "Parent project not found" }, { status: 404 });
  }

  // If linked to a process, verify it exists and get step labels for seeding checklist
  let processStepLabels: string[] = [];
  if (processTemplateId) {
    const template = await prisma.processTemplate.findUnique({
      where: { id: processTemplateId },
      include: {
        steps: {
          where: { type: "step" },
          orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
        },
      },
    });
    if (!template) {
      return NextResponse.json({ error: "Process template not found" }, { status: 404 });
    }
    processStepLabels = template.steps.map((s) => s.label).filter(Boolean);
  }

  const itemLabels = [...processStepLabels, ...customItems];

  try {
    const project = await prisma.project.create({
      data: {
        name,
        type: parent.type,
        types: parent.types,
        isDraft: true,
        parentProjectId: parentId,
        processTemplateId,
        jobNumber: parent.jobNumber,
        clientFirstName: parent.clientFirstName,
        clientLastName: parent.clientLastName,
        clientEmail: parent.clientEmail,
        clientPhone: parent.clientPhone,
        clientAddress: parent.clientAddress,
        projectSettings: {
          create: {
            markup: 2.5,
            taxEnabled: false,
            taxRate: 0.14975,
          },
        },
      },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        costLines: true,
        parentProject: { select: { id: true, name: true } },
      },
    });
    for (let i = 0; i < itemLabels.length; i++) {
      await prisma.projectTaskItem.create({
        data: { projectId: project.id, label: itemLabels[i], sortOrder: i },
      });
    }
    const withItems = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        costLines: true,
        parentProject: { select: { id: true, name: true } },
        taskItems: { orderBy: { sortOrder: "asc" } },
      },
    });
    await logAudit(project.id, "created", `Sub-project: ${name}`);
    return NextResponse.json(withItems);
  } catch (err) {
    console.error("POST /api/projects/[id]/sub-projects error:", err);
    return NextResponse.json(
      { error: "Failed to create sub-project" },
      { status: 500 }
    );
  }
}
