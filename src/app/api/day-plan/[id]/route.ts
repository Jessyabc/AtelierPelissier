import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PATCH: Update day plan item (reorder, edit manual fields)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (typeof data.sortOrder === "number") update.sortOrder = data.sortOrder;
    if (data.title !== undefined) update.title = data.title;
    if (data.scheduledTime !== undefined) update.scheduledTime = data.scheduledTime;
    if (data.address !== undefined) update.address = data.address;
    if (data.notes !== undefined) update.notes = data.notes;

    const item = await prisma.dayPlanItem.update({
      where: { id },
      data: update,
      include: { serviceCall: { include: { project: { select: { id: true, jobNumber: true } } } } },
    });

    if (item.type === "service_call" && item.serviceCall) {
      const sc = item.serviceCall;
      return NextResponse.json({
        id: item.id,
        type: "service_call",
        sortOrder: item.sortOrder,
        time: sc.timeOfArrival ? new Date(sc.timeOfArrival).toTimeString().slice(0, 5) : "",
        title: sc.serviceCallNumber ?? sc.jobNumber ?? sc.clientName ?? "Service call",
        address: sc.address,
        jobNumber: sc.jobNumber ?? sc.project?.jobNumber,
        clientName: sc.clientName,
        projectId: sc.projectId,
      });
    }
    return NextResponse.json({
      id: item.id,
      type: "manual",
      sortOrder: item.sortOrder,
      time: item.scheduledTime ?? "",
      title: item.title ?? "",
      address: item.address,
      notes: item.notes,
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PATCH /api/day-plan/[id] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

/**
 * DELETE: Remove from day plan
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.dayPlanItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/day-plan/[id] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
