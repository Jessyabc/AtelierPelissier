import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { APP_ROLES } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** Admin-only: list pending invites */
export async function GET() {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const invites = await prisma.invite.findMany({
    where: { usedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(invites);
}

/** Admin-only: create invite */
export async function POST(req: NextRequest) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim();

  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (!APP_ROLES.includes(role as (typeof APP_ROLES)[number])) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      token,
      expiresAt,
      createdByUserId: session.dbUser.id,
    },
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const inviteUrl = base
    ? `${base}/login?invite=${encodeURIComponent(token)}`
    : `/login?invite=${encodeURIComponent(token)}`;

  return NextResponse.json({ invite: { id: invite.id, email, role, expiresAt }, inviteUrl });
}
