import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: All events for a single day — service calls + manual events.
 * Sorted by time for route planning. Use for printing day's schedule.
 * ?date=2026-02-13
 */
export async function GET(request: Request) {
  try {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }

  const [y, m, d] = dateParam.split("-").map(Number);
  if (!y || !m || !d) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const dayStart = new Date(y, m - 1, d);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  const [serviceCalls, manualEvents] = await Promise.all([
    prisma.serviceCall.findMany({
      where: { serviceDate: { gte: dayStart, lte: dayEnd } },
      include: {
        project: {
          select: { id: true, name: true, jobNumber: true, clientFirstName: true, clientLastName: true },
        },
      },
      orderBy: { timeOfArrival: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { eventDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ scheduledTime: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  type DayEvent = {
    id: string;
    type: "service_call" | "manual";
    time: string; // "HH:MM" or "" for sorting
    sortOrder: number;
    title: string;
    address: string | null;
    jobNumber?: string | null;
    clientName?: string;
    projectId?: string;
    notes?: string | null;
  };

  const events: DayEvent[] = [];

  for (const sc of serviceCalls) {
    const timeStr = sc.timeOfArrival
      ? new Date(sc.timeOfArrival).toTimeString().slice(0, 5)
      : "";
    events.push({
      id: sc.id,
      type: "service_call",
      time: timeStr,
      sortOrder: 0,
      title: sc.serviceCallNumber ?? sc.jobNumber ?? sc.clientName ?? "Service call",
      address: sc.address,
      jobNumber: sc.jobNumber ?? sc.project?.jobNumber,
      clientName: sc.clientName ?? ([sc.project?.clientFirstName, sc.project?.clientLastName].filter(Boolean).join(" ") || undefined),
      projectId: sc.projectId,
    });
  }

  for (const ev of manualEvents) {
    events.push({
      id: ev.id,
      type: "manual",
      time: ev.scheduledTime ?? "",
      sortOrder: ev.sortOrder,
      title: ev.title,
      address: ev.address,
      notes: ev.notes,
    });
  }

  // Sort: by time (empty string last), then by sortOrder
  events.sort((a, b) => {
    const timeCompare = (a.time || "23:59").localeCompare(b.time || "23:59");
    if (timeCompare !== 0) return timeCompare;
    return a.sortOrder - b.sortOrder;
  });

  return NextResponse.json({
    date: dateParam,
    events,
  });
  } catch (err) {
    console.error("GET /api/calendar/day error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Day load failed" },
      { status: 500 }
    );
  }
}
