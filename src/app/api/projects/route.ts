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
    orderBy: { updatedAt: "desc" },
    include: {
      projectSettings: { include: { sheetFormat: true } },
      costLines: true,
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
  const { name, types: typesList, jobNumber, clientFirstName, clientLastName, clientEmail, clientPhone, clientAddress } = parsed.data;
  const typesStr = typesList.join(",");
  const firstType = typesList[0] ?? "vanity";

  try {
    const project = await prisma.project.create({
      data: {
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
      },
      include: {
        projectSettings: { include: { sheetFormat: true } },
        costLines: true,
      },
    });
    await logAudit(project.id, "created", `Draft: ${name}`);
    return NextResponse.json(project);
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
