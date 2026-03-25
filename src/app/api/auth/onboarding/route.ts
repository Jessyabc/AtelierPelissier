import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Complete onboarding: optionally link this login to an Employee record.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  const body = (await req.json()) as { employeeId?: string | null; name?: string | null };

  if (body.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    await prisma.user.update({
      where: { id: session.dbUser.id },
      data: {
        employeeId: emp.id,
        name: body.name?.trim() || emp.name,
        onboardingComplete: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: session.dbUser.id },
      data: {
        name: body.name?.trim() || session.dbUser.name,
        onboardingComplete: true,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
