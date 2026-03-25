import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Links a Supabase user to Neon after opening an invite link (`/login?invite=TOKEN`).
 * Requires an active session; invite email must match the signed-in user's email.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser();
  if (error || !supabaseUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }

  const email = supabaseUser.email.toLowerCase().trim();
  if (invite.email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: "Signed-in email must match the invite email" },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { supabaseUserId: supabaseUser.id },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyLinked: true });
  }

  await prisma.user.create({
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

  return NextResponse.json({ ok: true });
}
