import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * PATCH: Update a ProjectProcessStep (assignment, schedule, status, notes, duration).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  const { id: projectId, stepId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignedEmployeeId, scheduledDate, estimatedMinutes, status, notes, label, sortOrder } =
    body as {
      assignedEmployeeId?: string | null;
      scheduledDate?: string | null;
      estimatedMinutes?: number | null;
      status?: string;
      notes?: string | null;
      label?: string;
      sortOrder?: number;
    };

  // Build update payload with only provided fields
  const data: Record<string, unknown> = {};
  if ("assignedEmployeeId" in (body as object)) data.assignedEmployeeId = assignedEmployeeId ?? null;
  if ("scheduledDate" in (body as object))
    data.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
  if ("estimatedMinutes" in (body as object)) data.estimatedMinutes = estimatedMinutes ?? null;
  if ("status" in (body as object)) {
    data.status = status;
    if (status === "done") data.completedAt = new Date();
    else if (status !== "done") data.completedAt = null;
  }
  if ("notes" in (body as object)) data.notes = notes ?? null;
  if ("label" in (body as object) && label?.trim()) data.label = label.trim();
  if ("sortOrder" in (body as object)) data.sortOrder = sortOrder;

  const step = await prisma.projectProcessStep.update({
    where: { id: stepId, projectId },
    data,
    include: {
      assignedEmployee: { select: { id: true, name: true, color: true, role: true } },
      step: { select: { id: true, label: true, estimatedMinutes: true, type: true } },
    },
  });

  return NextResponse.json(step);
}

/**
 * DELETE: Remove a ProjectProcessStep.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  const { id: projectId, stepId } = await params;

  await prisma.projectProcessStep.delete({
    where: { id: stepId, projectId },
  });

  return NextResponse.json({ ok: true });
}
