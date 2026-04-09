import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";

const IMPERSONATION_COOKIE = "apops_view_as_role";

function normalizeRole(input: unknown): AppRole | null {
  if (typeof input !== "string") return null;
  const role = input.trim();
  if (!APP_ROLES.includes(role as AppRole)) return null;
  // "admin" impersonation is a no-op; clearing is more explicit.
  if ((role as AppRole) === "admin") return null;
  return role as AppRole;
}

export async function POST(req: Request) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const role = normalizeRole(body.role);
  if (!role) {
    return NextResponse.json(
      { error: "Invalid role. Use planner, salesperson, or woodworker." },
      { status: 400 }
    );
  }

  cookies().set(IMPERSONATION_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return NextResponse.json({ ok: true, impersonation: { role } });
}

export async function DELETE() {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  cookies().delete(IMPERSONATION_COOKIE);
  return NextResponse.json({ ok: true });
}

