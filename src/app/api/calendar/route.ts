import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET: Service calls for calendar view.
 * Query: ?year=2025&month=2 (1-indexed)
 * Returns events with serviceDate in that month.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) - 1 : now.getMonth();

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [serviceCalls, manualEvents, processSteps] = await Promise.all([
    prisma.serviceCall.findMany({
      where: { serviceDate: { gte: start, lte: end } },
      include: {
        project: {
          select: { id: true, name: true, jobNumber: true, clientFirstName: true, clientLastName: true },
        },
      },
      orderBy: [{ serviceDate: "asc" }, { timeOfArrival: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: { eventDate: { gte: start, lte: end } },
      orderBy: [{ eventDate: "asc" }, { scheduledTime: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.projectProcessStep.findMany({
      where: { scheduledDate: { gte: start, lte: end } },
      include: {
        project: { select: { id: true, name: true, jobNumber: true } },
        assignedEmployee: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  type CalendarEventItem = {
    id: string;
    type: "service_call" | "manual" | "process_step";
    projectId?: string;
    serviceCallNumber?: string | null;
    serviceCallType?: string | null;
    serviceDate: string;
    timeOfArrival?: string | null;
    clientName: string;
    jobNumber: string | null;
    projectName?: string;
    address: string | null;
    /** process_step extras */
    stepLabel?: string;
    assignedTo?: string | null;
    assignedColor?: string | null;
    estimatedMinutes?: number | null;
    stepStatus?: string;
  };

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const events: CalendarEventItem[] = serviceCalls.map((sc) => ({
    id: sc.id,
    type: "service_call" as const,
    projectId: sc.projectId,
    serviceCallNumber: sc.serviceCallNumber,
    serviceCallType: sc.serviceCallType,
    serviceDate: sc.serviceDate ? toDateStr(new Date(sc.serviceDate)) : "",
    timeOfArrival: sc.timeOfArrival ? sc.timeOfArrival.toISOString() : null,
    clientName: sc.clientName ?? ([sc.project.clientFirstName, sc.project.clientLastName].filter(Boolean).join(" ") || "—"),
    jobNumber: sc.jobNumber ?? sc.project.jobNumber,
    projectName: sc.project.name,
    address: sc.address,
  }));

  for (const ev of manualEvents) {
    const d = ev.eventDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    events.push({
      id: ev.id,
      type: "manual",
      serviceDate: dateStr,
      timeOfArrival: ev.scheduledTime ? `1970-01-01T${ev.scheduledTime}:00` : null,
      clientName: ev.title,
      jobNumber: null,
      address: ev.address,
    });
  }

  // Add process steps
  for (const ps of processSteps) {
    if (!ps.scheduledDate) continue;
    events.push({
      id: ps.id,
      type: "process_step",
      projectId: ps.projectId,
      serviceDate: toDateStr(new Date(ps.scheduledDate)),
      clientName: ps.label,
      jobNumber: ps.project.jobNumber,
      projectName: ps.project.name,
      address: null,
      stepLabel: ps.label,
      assignedTo: ps.assignedEmployee?.name ?? null,
      assignedColor: ps.assignedEmployee?.color ?? null,
      estimatedMinutes: ps.estimatedMinutes,
      stepStatus: ps.status,
    });
  }

  // Sort by date then time (serviceDate is string "YYYY-MM-DD")
  events.sort((a, b) => {
    const dCompare = (a.serviceDate || "").localeCompare(b.serviceDate || "");
    if (dCompare !== 0) return dCompare;
    const tA = a.timeOfArrival ? new Date(a.timeOfArrival as string).getTime() : 999999;
    const tB = b.timeOfArrival ? new Date(b.timeOfArrival as string).getTime() : 999999;
    return tA - tB;
  });

  return NextResponse.json({
    year,
    month: month + 1,
    events,
  });
  } catch (err) {
    console.error("GET /api/calendar error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Calendar load failed" },
      { status: 500 }
    );
  }
}
