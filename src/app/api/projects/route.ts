import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createProjectSchema } from "@/lib/validators";

const PROJECTS_GET_TIMEOUT_MS = 8000;

export async function GET() {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), PROJECTS_GET_TIMEOUT_MS)
  );
  const fetchPromise = prisma.project.findMany({
    where: { parentProjectId: null },
    orderBy: { updatedAt: "desc" },
    include: {
      projectSettings: { include: { sheetFormat: true } },
      costLines: true,
      subProjects: {
        select: {
          id: true,
          name: true,
          isDone: true,
          isDraft: true,
          updatedAt: true,
          processTemplateId: true,
          processTemplate: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  try {
    const projects = await Promise.race([fetchPromise, timeoutPromise]);
    return NextResponse.json(projects);
  } catch (err) {
    if ((err as Error)?.message === "Timeout") {
      console.error("GET /api/projects: timeout");
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 503 }
      );
    }
    console.error("GET /api/projects error:", err);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { name, types: typesList, jobNumber, parentProjectId, clientFirstName, clientLastName, clientEmail, clientPhone, clientAddress } = parsed.data;
  const typesStr = typesList.join(",");
  const firstType = typesList[0] ?? "vanity";

  let createData: Parameters<typeof prisma.project.create>[0]["data"];
  if (parentProjectId) {
    const parent = await prisma.project.findUnique({
      where: { id: parentProjectId },
      select: { jobNumber: true, clientFirstName: true, clientLastName: true, clientEmail: true, clientPhone: true, clientAddress: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent project not found" }, { status: 404 });
    }
    createData = {
      name,
      type: firstType,
      types: typesStr,
      isDraft: true,
      parentProjectId,
      jobNumber: jobNumber?.trim() || parent.jobNumber,
      clientFirstName: clientFirstName ?? parent.clientFirstName,
      clientLastName: clientLastName ?? parent.clientLastName,
      clientEmail: clientEmail ?? parent.clientEmail,
      clientPhone: clientPhone ?? parent.clientPhone,
      clientAddress: clientAddress ?? parent.clientAddress,
      projectSettings: {
        create: {
          markup: 2.5,
          taxEnabled: false,
          taxRate: 0.14975,
        },
      },
    };
  } else {
    createData = {
      name,
      type: firstType,
      types: typesStr,
      isDraft: true,
      jobNumber: jobNumber?.trim() || null,
      clientFirstName: clientFirstName || null,
      clientLastName: clientLastName || null,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      projectSettings: {
        create: {
          markup: 2.5,
          taxEnabled: false,
          taxRate: 0.14975,
        },
      },
    };
  }

  try {
    const project = await prisma.project.create({
      data: createData,
      include: {
        projectSettings: { include: { sheetFormat: true } },
        costLines: true,
        subProjects: true,
      },
    });
    await logAudit(project.id, "created", parentProjectId ? `Sub-project: ${name}` : `Draft: ${name}`);
    return NextResponse.json(project);
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
