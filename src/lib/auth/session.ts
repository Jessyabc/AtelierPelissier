import { NextResponse } from "next/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User as DbUser } from "@prisma/client";

export type SessionResult =
  | { ok: true; supabaseUser: SupabaseAuthUser; dbUser: DbUser }
  | { ok: false; response: NextResponse };

/**
 * Resolve Neon User row for the current Supabase session, bootstrapping the first admin or a pending invite by email.
 */
export async function resolveDbUser(supabaseUser: SupabaseAuthUser): Promise<DbUser | null> {
  const existing = await prisma.user.findUnique({
    where: { supabaseUserId: supabaseUser.id },
  });
  if (existing) return existing;

  const email = supabaseUser.email?.toLowerCase().trim();
  if (!email) return null;

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    return prisma.user.create({
      data: {
        supabaseUserId: supabaseUser.id,
        email,
        name: (supabaseUser.user_metadata?.name as string | undefined) ?? null,
        role: "admin",
        onboardingComplete: false,
      },
    });
  }

  const invite = await prisma.invite.findFirst({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!invite) return null;

  const created = await prisma.user.create({
    data: {
      supabaseUserId: supabaseUser.id,
      email,
      name: (supabaseUser.user_metadata?.name as string | undefined) ?? null,
      role: invite.role,
      onboardingComplete: false,
    },
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  return created;
}

export async function getSessionWithUser(): Promise<SessionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Auth not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)." },
        { status: 503 }
      ),
    };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !supabaseUser) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const dbUser = await resolveDbUser(supabaseUser);
  if (!dbUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No account for this user. Ask an admin for an invite." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, supabaseUser, dbUser };
}

export async function requireRole(allowed: string[]): Promise<SessionResult> {
  const session = await getSessionWithUser();
  if (!session.ok) return session;
  if (!allowed.includes(session.dbUser.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return session;
}
