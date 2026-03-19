import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: list punches, optionally filtered
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const employeeId = searchParams.get("employeeId");
  const date = searchParams.get("date"); // YYYY-MM-DD, returns that day's punches
  const activeOnly = searchParams.get("active") === "true";

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (employeeId) where.employeeId = employeeId;
  if (activeOnly) where.endTime = null;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.startTime = { gte: start, lte: end };
  }

  const punches = await prisma.timePunch.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, color: true, role: true } },
      station: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true, jobNumber: true } },
    },
    orderBy: { startTime: "desc" },
  });
  return NextResponse.json(punches);
}

// POST: clock in — creates a new punch
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { employeeId, stationId, projectId, notes } = body as Record<string, unknown>;
  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (!employee.active) {
    return NextResponse.json(
      { error: "This team member is inactive. Activate them under Admin → Team Members." },
      { status: 400 }
    );
  }

  let resolvedStationId: string | null = null;
  if (typeof stationId === "string" && stationId.trim()) {
    const station = await prisma.workStation.findUnique({ where: { id: stationId.trim() } });
    if (!station) {
      return NextResponse.json({ error: "Work station not found" }, { status: 404 });
    }
    if (!station.active) {
      return NextResponse.json(
        { error: "This station is disabled. Enable it under Admin → Work Stations & QR." },
        { status: 400 }
      );
    }
    resolvedStationId = station.id;
  }

  if (typeof projectId === "string" && projectId.trim()) {
    const proj = await prisma.project.findUnique({ where: { id: projectId.trim() } });
    if (!proj) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  // Auto clock-out any existing active punch for this employee
  const existingActive = await prisma.timePunch.findFirst({
    where: { employeeId, endTime: null },
  });
  if (existingActive) {
    const now = new Date();
    const duration = Math.round((now.getTime() - existingActive.startTime.getTime()) / 60000);
    await prisma.timePunch.update({
      where: { id: existingActive.id },
      data: { endTime: now, durationMinutes: duration },
    });
  }

  const punch = await prisma.timePunch.create({
    data: {
      employeeId,
      stationId: resolvedStationId,
      projectId: typeof projectId === "string" && projectId.trim() ? projectId.trim() : null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
    },
    include: {
      employee: { select: { id: true, name: true, color: true } },
      station: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true, jobNumber: true } },
    },
  });
  return NextResponse.json(punch, { status: 201 });
}
