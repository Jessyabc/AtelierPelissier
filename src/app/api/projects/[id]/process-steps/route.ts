import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderedTemplateSteps } from "@/lib/processTemplate";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET: List all ProjectProcessSteps for a project, with assigned employee info.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const steps = await prisma.projectProcessStep.findMany({
    where: { projectId },
    include: {
      assignedEmployee: { select: { id: true, name: true, color: true, role: true } },
      step: { select: { id: true, label: true, estimatedMinutes: true, type: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(steps);
}

/**
 * POST: Seed ProjectProcessSteps from the project's assigned process template,
 * or add a single ad-hoc step.
 *
 * Body (seed from template): { action: "seed", replace?: boolean }
 *   replace=true deletes existing ProjectProcessSteps first (fix wrong template seed).
 * Body (ad-hoc):             { action: "add", label, estimatedMinutes? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  const { id: projectId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, label, estimatedMinutes, replace } = body as {
    action: "seed" | "add";
    label?: string;
    estimatedMinutes?: number;
    replace?: boolean;
  };

  if (action === "seed") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { processTemplateId: true },
    });
    if (!project?.processTemplateId) {
      return NextResponse.json({ error: "Project has no process template assigned" }, { status: 400 });
    }

    const existing = await prisma.projectProcessStep.count({ where: { projectId } });
    if (existing > 0 && !replace) {
      return NextResponse.json(
        { error: "Steps already seeded for this project. Send replace: true to reload from template." },
        { status: 409 }
      );
    }
    if (existing > 0 && replace) {
      await prisma.projectProcessStep.deleteMany({ where: { projectId } });
    }

    // Must match per-room checklist logic (getOrderedTemplateSteps): include decision nodes,
    // not only type "step" — otherwise Planning/Shipping etc. are missing vs the flowchart.
    const templateSteps =
      (await getOrderedTemplateSteps(project.processTemplateId)) ?? [];

    if (templateSteps.length === 0) {
      return NextResponse.json(
        {
          error:
            "No steps to load from this template (only Start/End, or empty). Add steps in Processes.",
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(
      templateSteps.map((s, idx) =>
        prisma.projectProcessStep.create({
          data: {
            projectId,
            stepId: s.id,
            label: s.label,
            description: s.description,
            sortOrder: idx,
            estimatedMinutes: s.estimatedMinutes ?? null,
          },
          include: {
            assignedEmployee: { select: { id: true, name: true, color: true, role: true } },
          },
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  }

  if (action === "add") {
    if (!label?.trim()) {
      return NextResponse.json({ error: "label is required for ad-hoc step" }, { status: 400 });
    }
    const maxOrder = await prisma.projectProcessStep.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const step = await prisma.projectProcessStep.create({
      data: {
        projectId,
        label: label.trim(),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        estimatedMinutes: estimatedMinutes ?? null,
      },
      include: {
        assignedEmployee: { select: { id: true, name: true, color: true, role: true } },
      },
    });
    return NextResponse.json(step, { status: 201 });
  }

  return NextResponse.json({ error: "action must be 'seed' or 'add'" }, { status: 400 });
}
