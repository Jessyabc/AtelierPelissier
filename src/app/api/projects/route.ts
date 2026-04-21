import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createProjectSchema } from "@/lib/validators";
import { getOrderedStepLabels } from "@/lib/processTemplate";
import { withAuth } from "@/lib/auth/guard";

const PROJECTS_GET_TIMEOUT_MS = 8000;

// GET /api/projects — authenticated, any role. List payload is not
// per-role filtered yet (still shows all projects to every role); that's
// tracked as a follow-up. Here we at minimum require a session.
export const GET = withAuth("any", async () => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), PROJECTS_GET_TIMEOUT_MS)
  );
  // IMPORTANT: This endpoint backs the home dashboard list. Keep it *light*.
  // Full project graphs (taskItems, nested projectItems, etc.) belong on
  // GET /api/projects/[id]. Heavy includes here are the primary cause of
  // dashboard timeouts in production.
  const fetchPromise = prisma.project.findMany({
    where: { parentProjectId: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      types: true,
      stage: true,
      depositReceivedAt: true,
      isDraft: true,
      isDone: true,
      updatedAt: true,
      archivedAt: true,
      lostReason: true,
      lastSalesActivityAt: true,
      blockedReason: true,
      // Flat client fields (used by home search + ProjectCard)
      clientFirstName: true,
      clientLastName: true,
      clientEmail: true,
      clientPhone: true,
      clientPhone2: true,
      clientAddress: true,
      // Used for home money totals; full line editing stays on project page.
      costLines: { select: { amount: true, kind: true, category: true } },
      // Sub-projects are shown as lightweight follow-ups on cards.
      subProjects: {
        select: { id: true, name: true, isDone: true, isDraft: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      // Settings is needed for pricing badges in a few surfaces; keep minimal.
      projectSettings: { select: { markup: true, taxEnabled: true, taxRate: true } },
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
});

// POST /api/projects — create project. No project id yet so no scope check;
// role policy matches previous behavior (admin / planner / salesperson).
export const POST = withAuth(["admin", "planner", "salesperson"], async ({ req }) => {
  let body: unknown;
  try {
    body = await req.json();
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
  const {
    name,
    types: typesList,
    jobNumber,
    parentProjectId,
    processTemplateId,
    clientId,
    client: clientInput,
    client2Id,
    client2: client2Input,
    clientFirstName,
    clientLastName,
    clientEmail,
    clientPhone,
    clientPhone2,
    clientAddress,
    targetDate,
    stage,
    depositReceivedAt,
  } = parsed.data;
  const typesStr = typesList.join(",");
  const firstType = typesList[0] ?? "vanity";
  // If the caller marks a project as confirmed but forgot a deposit timestamp,
  // stamp it as "now" so stage and timestamp stay consistent in the DB.
  const resolvedDepositAt: Date | null = depositReceivedAt
    ? new Date(depositReceivedAt)
    : stage === "confirmed"
      ? new Date()
      : null;

  // Resolve primary client: existing by id, or create from input
  let resolvedClientId: string | null = clientId ?? null;
  if (!resolvedClientId && clientInput) {
    const c = await prisma.client.create({
      data: {
        firstName: clientInput.firstName,
        lastName: clientInput.lastName,
        email: clientInput.email || null,
        phone: clientInput.phone || null,
        phone2: clientInput.phone2 || null,
        address: clientInput.address || null,
      },
    });
    resolvedClientId = c.id;
  }

  // Resolve secondary client
  let resolvedClient2Id: string | null = client2Id ?? null;
  if (!resolvedClient2Id && client2Input) {
    const c = await prisma.client.create({
      data: {
        firstName: client2Input.firstName,
        lastName: client2Input.lastName,
        email: client2Input.email || null,
        phone: client2Input.phone || null,
        phone2: client2Input.phone2 || null,
        address: client2Input.address || null,
      },
    });
    resolvedClient2Id = c.id;
  }

  // Build embedded client fields (from Client when linked, else legacy inline)
  const getEmbeddedFromClient = (c: { firstName: string; lastName: string; email: string | null; phone: string | null; phone2: string | null; address: string | null } | null): Record<string, string | null> =>
    c ? { clientFirstName: c.firstName, clientLastName: c.lastName, clientEmail: c.email, clientPhone: c.phone, clientPhone2: c.phone2, clientAddress: c.address } : {};

  let embeddedPrimary: Record<string, string | null> = {};
  if (resolvedClientId) {
    const c = await prisma.client.findUnique({ where: { id: resolvedClientId } });
    embeddedPrimary = getEmbeddedFromClient(c);
  } else if (clientFirstName || clientLastName || clientEmail || clientPhone || clientAddress) {
    embeddedPrimary = {
      clientFirstName: clientFirstName || null,
      clientLastName: clientLastName || null,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      clientPhone2: clientPhone2 || null,
      clientAddress: clientAddress || null,
    };
  }

  let createData: Parameters<typeof prisma.project.create>[0]["data"];
  if (parentProjectId) {
    const parent = await prisma.project.findUnique({
      where: { id: parentProjectId },
      select: { jobNumber: true, clientFirstName: true, clientLastName: true, clientEmail: true, clientPhone: true, clientPhone2: true, clientAddress: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent project not found" }, { status: 404 });
    }
    createData = {
      name,
      type: firstType,
      types: typesStr,
      isDraft: true,
      stage,
      depositReceivedAt: resolvedDepositAt,
      // Fresh project = fresh sales activity; see lib/projectLifecycle.ts.
      lastSalesActivityAt: new Date(),
      parentProjectId,
      jobNumber: jobNumber?.trim() || parent.jobNumber,
      clientId: resolvedClientId,
      client2Id: resolvedClient2Id,
      clientFirstName: (embeddedPrimary as { clientFirstName?: string | null }).clientFirstName ?? parent.clientFirstName,
      clientLastName: (embeddedPrimary as { clientLastName?: string | null }).clientLastName ?? parent.clientLastName,
      clientEmail: (embeddedPrimary as { clientEmail?: string | null }).clientEmail ?? parent.clientEmail,
      clientPhone: (embeddedPrimary as { clientPhone?: string | null }).clientPhone ?? parent.clientPhone,
      clientPhone2: (embeddedPrimary as { clientPhone2?: string | null }).clientPhone2 ?? parent.clientPhone2,
      clientAddress: (embeddedPrimary as { clientAddress?: string | null }).clientAddress ?? parent.clientAddress,
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
      stage,
      depositReceivedAt: resolvedDepositAt,
      // Fresh project = fresh sales activity; see lib/projectLifecycle.ts.
      lastSalesActivityAt: new Date(),
      jobNumber: jobNumber?.trim() || null,
      processTemplateId: processTemplateId?.trim() || null,
      clientId: resolvedClientId,
      client2Id: resolvedClient2Id,
      ...embeddedPrimary,
      targetDate: targetDate ? new Date(targetDate) : null,
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

    // For main projects with processTemplateId, seed task items from template
    if (!parentProjectId && processTemplateId?.trim()) {
      const labels = await getOrderedStepLabels(processTemplateId.trim());
      if (labels === null) {
        await prisma.project.delete({ where: { id: project.id } });
        return NextResponse.json({ error: "Process template not found" }, { status: 404 });
      }
      for (let i = 0; i < labels.length; i++) {
        await prisma.projectTaskItem.create({
          data: { projectId: project.id, label: labels[i], sortOrder: i },
        });
      }
      const withItems = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          projectSettings: { include: { sheetFormat: true } },
          costLines: true,
          subProjects: true,
          taskItems: { orderBy: { sortOrder: "asc" } },
          processTemplate: { select: { id: true, name: true } },
        },
      });
      await logAudit(project.id, "created", `Draft: ${name}`);
      return NextResponse.json(withItems ?? project);
    }

    await logAudit(project.id, "created", parentProjectId ? `Sub-project: ${name}` : `Draft: ${name}`);
    return NextResponse.json(project);
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
});
