import { NextResponse } from "next/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User as DbUser } from "@prisma/client";
import { cookies } from "next/headers";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";

export type SessionResult =
  | {
      ok: true;
      supabaseUser: SupabaseAuthUser;
      dbUser: DbUser;
      /** The role used for authorization checks (may be impersonated if admin enabled it). */
      effectiveRole: string;
      /** The original role on the DB user row (always the truth). */
      realRole: string;
      impersonation: null | { role: AppRole; enabledByAdminUserId: string };
    }
  | { ok: false; response: NextResponse };

const IMPERSONATION_COOKIE = "apops_view_as_role";

/**
 * Emails that are *always* admin regardless of DB state or invite flow.
 *
 * This is the app owner guard: if the account is ever accidentally downgraded,
 * invited with a lower role, or recreated, the owner can still log in as admin
 * and unblock the team. Read from env first, with a hardcoded fallback for the
 * canonical owner of this deployment (Jessy @ Evos Creations).
 *
 * To add more permanent owners, set APP_OWNER_EMAILS="a@x.com,b@y.com".
 */
export const PERMANENT_ADMIN_EMAILS: readonly string[] = (() => {
  const env = (process.env.APP_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Canonical owner of this deployment. Additional owners should go through
  // APP_OWNER_EMAILS env var rather than being appended here.
  const hardcoded = ["jessy@evos.ca"];
  return Array.from(new Set([...env, ...hardcoded]));
})();

export function isPermanentAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PERMANENT_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function resolveImpersonatedRole(dbUser: DbUser): null | AppRole {
  // Only admins can impersonate, and we never allow "impersonate admin" (no-op / confusing).
  if (dbUser.role !== "admin") return null;

  const raw = cookies().get(IMPERSONATION_COOKIE)?.value?.trim() ?? "";
  if (!raw) return null;
  if (!APP_ROLES.includes(raw as AppRole)) return null;
  if ((raw as AppRole) === "admin") return null;
  return raw as AppRole;
}

/**
 * Resolve Neon User row for the current Supabase session, bootstrapping the first admin or a pending invite by email.
 */
export async function resolveDbUser(supabaseUser: SupabaseAuthUser): Promise<DbUser | null> {
  const email = supabaseUser.email?.toLowerCase().trim() ?? null;
  const ownerOverride = isPermanentAdminEmail(email);

  const existing = await prisma.user.findUnique({
    where: { supabaseUserId: supabaseUser.id },
  });
  if (existing) {
    // Permanent admin guard: if the owner account exists but has drifted to a
    // lower role (invite mix-up, manual DB edit, seed script), force it back
    // to admin on every session fetch. Idempotent + audited via updatedAt.
    if (ownerOverride && existing.role !== "admin") {
      return prisma.user.update({
        where: { id: existing.id },
        data: { role: "admin" },
      });
    }
    return existing;
  }

  if (!email) return null;

  const userCount = await prisma.user.count();
  if (userCount === 0 || ownerOverride) {
    // First-ever user OR a permanent owner signing in for the first time:
    // auto-provision as admin without requiring an invite.
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

  const impersonatedRole = resolveImpersonatedRole(dbUser);
  const effectiveRole = impersonatedRole ?? dbUser.role;

  return {
    ok: true,
    supabaseUser,
    dbUser,
    effectiveRole,
    realRole: dbUser.role,
    impersonation: impersonatedRole
      ? { role: impersonatedRole, enabledByAdminUserId: dbUser.id }
      : null,
  };
}

export async function requireRole(allowed: string[]): Promise<SessionResult> {
  const session = await getSessionWithUser();
  if (!session.ok) return session;
  if (!allowed.includes(session.effectiveRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return session;
}
