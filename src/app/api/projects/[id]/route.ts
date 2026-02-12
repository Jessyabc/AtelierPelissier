import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { updateProjectSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        costLines: true,
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
  const updateData: {
    name?: string;
    type?: string;
    types?: string;
    isDraft?: boolean;
    jobNumber?: string | null;
    notes?: string | null;
    clientFirstName?: string | null;
    clientLastName?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
  } = {};
  if (data.name != null) updateData.name = data.name;
  if (data.types != null) {
    updateData.types = data.types.join(",");
    updateData.type = data.types[0] ?? undefined;
  }
  if (data.isDraft != null) updateData.isDraft = data.isDraft;
  if (data.jobNumber !== undefined) updateData.jobNumber = data.jobNumber;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.clientFirstName !== undefined) updateData.clientFirstName = data.clientFirstName;
  if (data.clientLastName !== undefined) updateData.clientLastName = data.clientLastName;
  if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
  if (data.clientPhone !== undefined) updateData.clientPhone = data.clientPhone;
  if (data.clientAddress !== undefined) updateData.clientAddress = data.clientAddress;

  if (Object.keys(updateData).length === 0) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        costLines: true,
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
  }

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
    include: {
      projectSettings: { include: { sheetFormat: true } },
      vanityInputs: true,
      sideUnitInputs: true,
      kitchenInputs: true,
      panelParts: true,
      costLines: true,
    },
  });
  if (data.isDraft === false) await logAudit(id, "saved");
  else if (
    data.clientFirstName !== undefined ||
    data.clientLastName !== undefined ||
    data.clientEmail !== undefined ||
    data.clientPhone !== undefined ||
    data.clientAddress !== undefined
  )
    await logAudit(id, "client_updated");
  return NextResponse.json(project);
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
