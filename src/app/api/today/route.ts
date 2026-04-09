import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/today
 *
 * Returns production steps assigned to the current user's employee record.
 * - "today" bucket: scheduledDate = today (local date via ?tz offset or UTC date match)
 * - "week" bucket: scheduledDate within the next 7 days (excluding today)
 * - "overdue" bucket: scheduledDate < today and status != "done"
 *
 * Also returns the employee profile so the UI can show name/color.
 */
export async function GET(request: Request) {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  const { dbUser } = session;

  if (!dbUser.employeeId) {
    // User has no linked employee — return empty buckets
    return NextResponse.json({
      employee: null,
      today: [],
      week: [],
      overdue: [],
    });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: dbUser.employeeId },
    select: { id: true, name: true, color: true, role: true },
  });

  // Compute date boundaries in UTC (dates stored as UTC midnight)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000); // next 7 days

  const include = {
    project: { select: { id: true, name: true, jobNumber: true } },
    step: { select: { id: true, label: true } },
  };

  const [todaySteps, weekSteps, overdueSteps] = await Promise.all([
    prisma.projectProcessStep.findMany({
      where: {
        assignedEmployeeId: dbUser.employeeId,
        scheduledDate: { gte: todayStart, lt: todayEnd },
        status: { not: "done" },
      },
      include,
      orderBy: { sortOrder: "asc" },
    }),
    prisma.projectProcessStep.findMany({
      where: {
        assignedEmployeeId: dbUser.employeeId,
        scheduledDate: { gte: todayEnd, lt: weekEnd },
        status: { not: "done" },
      },
      include,
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.projectProcessStep.findMany({
      where: {
        assignedEmployeeId: dbUser.employeeId,
        scheduledDate: { lt: todayStart },
        status: { not: "done" },
      },
      include,
      orderBy: { scheduledDate: "asc" },
    }),
  ]);

  return NextResponse.json({ employee, today: todaySteps, week: weekSteps, overdue: overdueSteps });
}
