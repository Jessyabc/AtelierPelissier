import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: Day plan for a date. Returns ordered list of events (service calls + manual).
 * ?date=2026-02-13
 * If no DayPlanItems exist, auto-populates from service calls + CalendarEvents for that day.
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
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const dayStart = new Date(y, m - 1, d);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

    // Fetch existing plan items
    let items = await prisma.dayPlanItem.findMany({
      where: { planDate: { gte: dayStart, lte: dayEnd } },
      include: { serviceCall: { include: { project: { select: { id: true, name: true, jobNumber: true } } } } },
      orderBy: { sortOrder: "asc" },
    });

    // If no plan exists, seed from service calls + calendar events
    if (items.length === 0) {
      const [serviceCalls, calendarEvents] = await Promise.all([
        prisma.serviceCall.findMany({
          where: { serviceDate: { gte: dayStart, lte: dayEnd } },
          include: { project: { select: { id: true, name: true, jobNumber: true } } },
          orderBy: { timeOfArrival: "asc" },
        }),
        prisma.calendarEvent.findMany({
          where: { eventDate: { gte: dayStart, lte: dayEnd } },
          orderBy: [{ scheduledTime: "asc" }, { sortOrder: "asc" }],
        }),
      ]);

      const toCreate: { planDate: Date; sortOrder: number; type: string; serviceCallId?: string; title?: string; scheduledTime?: string; address?: string; notes?: string }[] = [];
      let idx = 0;
      for (const sc of serviceCalls) {
        toCreate.push({
          planDate: dayStart,
          sortOrder: idx++,
          type: "service_call",
          serviceCallId: sc.id,
        });
      }
      for (const ev of calendarEvents) {
        toCreate.push({
          planDate: dayStart,
          sortOrder: idx++,
          type: "manual",
          title: ev.title,
          scheduledTime: ev.scheduledTime ?? undefined,
          address: ev.address ?? undefined,
          notes: ev.notes ?? undefined,
        });
      }
      if (toCreate.length > 0) {
        await prisma.dayPlanItem.createMany({ data: toCreate });
        items = await prisma.dayPlanItem.findMany({
          where: { planDate: { gte: dayStart, lte: dayEnd } },
          include: { serviceCall: { include: { project: { select: { id: true, name: true, jobNumber: true } } } } },
          orderBy: { sortOrder: "asc" },
        });
      }
    }

    const events = items.map((it) => {
      if (it.type === "service_call" && it.serviceCall) {
        const sc = it.serviceCall;
        const timeStr = sc.timeOfArrival
          ? new Date(sc.timeOfArrival).toTimeString().slice(0, 5)
          : "";
        return {
          id: it.id,
          serviceCallId: sc.id,
          type: "service_call" as const,
          sortOrder: it.sortOrder,
          time: timeStr,
          title: sc.serviceCallNumber ?? sc.jobNumber ?? sc.clientName ?? "Service call",
          address: sc.address,
          jobNumber: sc.jobNumber ?? sc.project?.jobNumber,
          clientName: sc.clientName,
          projectId: sc.projectId,
        };
      }
      return {
        id: it.id,
        type: "manual" as const,
        sortOrder: it.sortOrder,
        time: it.scheduledTime ?? "",
        title: it.title ?? "",
        address: it.address,
        notes: it.notes,
      };
    });

    return NextResponse.json({ date: dateParam, events });
  } catch (err) {
    console.error("GET /api/day-plan error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

/**
 * POST: Add an event to the day plan.
 * Body: { date, type, serviceCallId? (if service_call), title?, scheduledTime?, address?, notes? (if manual) }
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const dateParam = data.date as string;
    if (!dateParam) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const [y, m, day] = dateParam.split("-").map(Number);
    if (!y || !m || !day) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const planDate = new Date(y, m - 1, day);
    const type = (data.type as string) || "manual";

    if (type === "service_call") {
      const serviceCallId = data.serviceCallId as string;
      if (!serviceCallId) {
        return NextResponse.json({ error: "serviceCallId required for service_call" }, { status: 400 });
      }
      const maxOrder = await prisma.dayPlanItem.aggregate({
        where: { planDate: { gte: new Date(y, m - 1, day), lte: new Date(y, m - 1, day, 23, 59, 59) } },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      const item = await prisma.dayPlanItem.create({
        data: { planDate, sortOrder, type: "service_call", serviceCallId },
        include: { serviceCall: { include: { project: { select: { id: true, jobNumber: true } } } } },
      });
      const sc = item.serviceCall!;
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

    // manual
    const title = (data.title as string)?.trim();
    if (!title) {
      return NextResponse.json({ error: "title required for manual event" }, { status: 400 });
    }
    const maxOrder = await prisma.dayPlanItem.aggregate({
      where: { planDate: { gte: new Date(y, m - 1, day), lte: new Date(y, m - 1, day, 23, 59, 59) } },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const item = await prisma.dayPlanItem.create({
      data: {
        planDate,
        sortOrder,
        type: "manual",
        title,
        scheduledTime: (data.scheduledTime as string) || null,
        address: (data.address as string) || null,
        notes: (data.notes as string) || null,
      },
    });
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
    console.error("POST /api/day-plan error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
