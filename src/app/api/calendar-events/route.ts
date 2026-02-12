import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: List calendar events for a date or month.
 * ?date=2026-02-13 (single day) or ?year=2026&month=2 (whole month)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (dateParam) {
    const [y, m, d] = dateParam.split("-").map(Number);
    if (!y || !m || !d) {
      return NextResponse.json({ error: "Invalid date format (use YYYY-MM-DD)" }, { status: 400 });
    }
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    const events = await prisma.calendarEvent.findMany({
      where: { eventDate: { gte: start, lte: end } },
      orderBy: [{ scheduledTime: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json(events);
  }

  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10) - 1;
    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
    }
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const events = await prisma.calendarEvent.findMany({
      where: { eventDate: { gte: start, lte: end } },
      orderBy: [{ eventDate: "asc" }, { scheduledTime: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json(events);
  }

  return NextResponse.json({ error: "Provide date=YYYY-MM-DD or year and month" }, { status: 400 });
}

/**
 * POST: Create a manual calendar event
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventDate, scheduledTime, sortOrder = 0, title, address, notes } = body as {
    eventDate: string;
    scheduledTime?: string | null;
    sortOrder?: number;
    title?: string;
    address?: string | null;
    notes?: string | null;
  };

  if (!eventDate || !title?.trim()) {
    return NextResponse.json({ error: "eventDate and title are required" }, { status: 400 });
  }

  const d = new Date(eventDate);
  if (isNaN(d.getTime())) {
    return NextResponse.json({ error: "Invalid eventDate" }, { status: 400 });
  }

  try {
    const ev = await prisma.calendarEvent.create({
      data: {
        eventDate: d,
        scheduledTime: scheduledTime?.trim() || null,
        sortOrder: sortOrder ?? 0,
        title: title.trim(),
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    });
    return NextResponse.json(ev);
  } catch (err) {
    console.error("POST /api/calendar-events:", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
