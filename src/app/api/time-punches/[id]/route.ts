import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH: clock out or correct a punch
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { endTime, projectId, stationId, notes } = body as Record<string, unknown>;

  const punch = await prisma.timePunch.findUnique({ where: { id: params.id } });
  if (!punch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resolvedEnd = endTime ? new Date(endTime as string) : new Date();
  const duration = Math.round((resolvedEnd.getTime() - punch.startTime.getTime()) / 60000);

  const updated = await prisma.timePunch.update({
    where: { id: params.id },
    data: {
      endTime: resolvedEnd,
      durationMinutes: duration,
      ...(projectId !== undefined && { projectId: typeof projectId === "string" ? projectId : null }),
      ...(stationId !== undefined && { stationId: typeof stationId === "string" ? stationId : null }),
      ...(notes !== undefined && { notes: typeof notes === "string" ? notes.trim() || null : null }),
    },
    include: {
      employee: { select: { id: true, name: true, color: true } },
      station: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true, jobNumber: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await prisma.timePunch.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
