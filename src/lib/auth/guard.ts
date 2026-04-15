/**
 * Unified API auth guard.
 *
 * Why this exists
 * ───────────────
 * Every `route.ts` in `src/app/api/**` currently repeats:
 *
 *     const session = await requireRole(["admin"]);
 *     if (!session.ok) return session.response;
 *     // ... handler body ...
 *
 * That pattern:
 *   1. Leaks a "response-or-session" union into every handler.
 *   2. Makes it easy to forget the guard entirely (security gap in
 *      AUTH_RISK_MAP.md P1 — most project mutation routes trust the client).
 *   3. Gives us no single place to add logging, rate limiting, or audit.
 *
 * This helper wraps the handler so each route declares its policy *once* in
 * its signature, and an accidentally-undeclared policy becomes a type error.
 *
 * Usage
 * ─────
 *
 *     // Admin-only
 *     export const POST = withAuth("admin", async ({ req, session }) => {
 *       // session.dbUser is guaranteed to exist and be admin
 *     });
 *
 *     // Any authenticated user
 *     export const GET = withAuth("any", async ({ session }) => { ... });
 *
 *     // Multiple roles
 *     export const PATCH = withAuth(
 *       ["admin", "planner"],
 *       async ({ req, session }) => { ... }
 *     );
 *
 *     // Dynamic route params are forwarded as the third arg just like Next.js
 *     export const DELETE = withAuth(
 *       "admin",
 *       async ({ req, session, params }) => {
 *         const { id } = params;
 *       }
 *     );
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUser, type SessionResult } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";

export type AuthPolicy = "any" | AppRole | readonly AppRole[];

export type AuthedContext<P = unknown> = {
  req: NextRequest;
  params: P;
  /** Guaranteed-OK session (ok branch of SessionResult). */
  session: Extract<SessionResult, { ok: true }>;
};

type NextHandlerCtx<P> = { params: P };

export function withAuth<P = unknown>(
  policy: AuthPolicy,
  handler: (ctx: AuthedContext<P>) => Promise<Response> | Response
) {
  return async (req: NextRequest, ctx: NextHandlerCtx<P> = { params: {} as P }) => {
    const session = await getSessionWithUser();
    if (!session.ok) return session.response;

    if (policy !== "any") {
      const allowed = Array.isArray(policy) ? (policy as readonly string[]) : [policy as string];
      if (!allowed.includes(session.effectiveRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    try {
      return await handler({ req, params: ctx.params, session });
    } catch (err) {
      // Surface a consistent 500 shape; real error logging goes through the
      // existing `/api/admin/errors` sink from the client error boundary.
      const message = err instanceof Error ? err.message : "Internal Server Error";
      console.error("[withAuth] handler threw", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/**
 * Project-scoped guard: requires auth AND (for non-admin roles) that the user
 * is legitimately tied to the project — either as salesperson, planner owner,
 * or assigned employee. This is the missing P1 check from AUTH_RISK_MAP.md.
 *
 * For now it enforces a simple rule set we can tighten later:
 *   - admin/planner: full access
 *   - salesperson:   must be the assigned salesperson on the project
 *   - woodworker:    must have an assigned ProjectProcessStep on the project
 *
 * Returns the NextResponse (error) or { ok, session, projectId } on success.
 */
export async function requireProjectAccess(
  projectId: string
): Promise<
  | { ok: true; session: Extract<SessionResult, { ok: true }>; projectId: string }
  | { ok: false; response: Response }
> {
  const session = await getSessionWithUser();
  if (!session.ok) return { ok: false, response: session.response };

  const role = session.effectiveRole;
  if (role === "admin" || role === "planner") {
    return { ok: true, session, projectId };
  }

  // Lazy import so this module stays light for the majority of routes that
  // only need `withAuth` without DB access.
  const { prisma } = await import("@/lib/db");

  if (role === "salesperson") {
    const proj = await prisma.project.findFirst({
      where: { id: projectId, salespersonId: session.dbUser.employeeId ?? undefined },
      select: { id: true },
    });
    if (!proj) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Not your project" }, { status: 403 }),
      };
    }
    return { ok: true, session, projectId };
  }

  if (role === "woodworker") {
    const assignment = await prisma.projectProcessStep.findFirst({
      where: { projectId, assignedEmployeeId: session.dbUser.employeeId ?? undefined },
      select: { id: true },
    });
    if (!assignment) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Not assigned to this project" }, { status: 403 }),
      };
    }
    return { ok: true, session, projectId };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}
