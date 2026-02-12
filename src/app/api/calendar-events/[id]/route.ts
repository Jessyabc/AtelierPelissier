import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PATCH: Update a calendar event (including sortOrder for reordering)
 */
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

  const data = body as Record<string, unknown>;
  const allowed = ["eventDate", "scheduledTime", "sortOrder", "title", "address", "notes"] as const;
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (data[k] !== undefined) {
      if (k === "eventDate" && typeof data[k] === "string") {
        update[k] = new Date(data[k] as string);
      } else {
        update[k] = data[k];
      }
    }
  }

  try {
    const ev = await prisma.calendarEvent.update({
      where: { id },
      data: update,
    });
    return NextResponse.json(ev);
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    console.error("PATCH /api/calendar-events/[id]:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE: Remove a calendar event
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    console.error("DELETE /api/calendar-events/[id]:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
