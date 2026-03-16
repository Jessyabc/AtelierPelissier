import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET all currently active punches (no endTime), or check a specific employee
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  const punches = await prisma.timePunch.findMany({
    where: {
      endTime: null,
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, color: true, role: true } },
      station: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true, jobNumber: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json(punches);
}
