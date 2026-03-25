import { NextResponse } from "next/server";
import { getSessionWithUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  return NextResponse.json({
    user: {
      id: session.dbUser.id,
      email: session.dbUser.email,
      name: session.dbUser.name,
      role: session.dbUser.role,
      onboardingComplete: session.dbUser.onboardingComplete,
      employeeId: session.dbUser.employeeId,
    },
  });
}
