/**
 * Unified API auth guard.
 *
 * Why this exists
 * ───────────────
 * Every `route.ts` in `src/app/api/**` used to repeat:
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
 * This module wraps handlers so each route declares its policy *once* in
 * its signature, and an accidentally-undeclared policy becomes a type error.
 *
 * Layered helpers
 * ───────────────
 * - `withAuth(policy, handler)` — enforces authentication + role policy.
 *   Use for routes that are not tied to a specific `Project` row (top-level
 *   collection endpoints, order endpoints, etc).
 * - `withProjectAuth(policy, handler)` — everything `withAuth` does, plus
 *   requires that the caller is legitimately tied to the project referenced
 *   by `params.id` (salesperson = assigned salesperson; woodworker = has an
 *   assigned process step). Admin + planner keep blanket access. Use on
 *   every `/api/projects/[id]/**` handler.
 *
 * Usage
 * ─────
 *
 *     // Top-level admin-only route
 *     export const POST = withAuth("admin", async ({ req, session }) => { ... });
 *
 *     // Project-scoped, sales-touchable route
 *     export const PATCH = withProjectAuth(
 *       ["admin", "planner", "salesperson"],
 *       async ({ req, session, params }) => {
 *         const { id } = params;
 *         // session is guaranteed OK; caller is tied to this project.
 *       }
 *     );
 *
 * Next.js 15 note
 * ───────────────
 * Route handlers receive `params` as a Promise. Both helpers await it before
 * passing it to the user-defined handler, so handlers see a plain object.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUser, type SessionResult } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";

export type AuthPolicy = "any" | AppRole | readonly AppRole[];

export type AuthedSession = Extract<SessionResult, { ok: true }>;

export type AuthedContext<P = Record<string, never>> = {
  req: NextRequest;
  params: P;
  /** Guaranteed-OK session (ok branch of SessionResult). */
  session: AuthedSession;
};

/** Next.js 15 route handler context: `params` arrives as a Promise. */
type NextRouteCtx<P> = { params: Promise<P> };

function policyAllows(policy: AuthPolicy, role: string): boolean {
  if (policy === "any") return true;
  const allowed = Array.isArray(policy)
    ? (policy as readonly string[])
    : [policy as string];
  return allowed.includes(role);
}

/**
 * Wrap a route handler with authentication + role enforcement.
 *
 * - Returns `401` if the caller is not authenticated.
 * - Returns `403` if the caller's effective role is not allowed.
 * - Returns `500` (without leaking the stack trace) if the handler throws.
 */
export function withAuth<P = Record<string, never>>(
  policy: AuthPolicy,
  handler: (ctx: AuthedContext<P>) => Promise<Response> | Response
) {
  return async (
    req: NextRequest,
    ctx: NextRouteCtx<P> = { params: Promise.resolve({} as P) }
  ): Promise<Response> => {
    const session = await getSessionWithUser();
    if (!session.ok) return session.response;

    if (!policyAllows(policy, session.effectiveRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const params = await ctx.params;
      return await handler({ req, params, session });
    } catch (err) {
      // Consistent 500 shape. Real error sinks happen in the client error
      // boundary + `/api/admin/errors`; we just log here.
      const message = err instanceof Error ? err.message : "Internal Server Error";
      console.error("[withAuth] handler threw", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/**
 * Inner project-access check that does NOT refetch the session. Used by
 * `withProjectAuth` (which already has the session from `withAuth`). Exported
 * for callers that need to make the check mid-handler for their own reasons.
 *
 * Rules:
 *   - admin/planner → full access
 *   - salesperson   → must be the assigned salesperson on the project
 *   - woodworker    → must have at least one assigned ProjectProcessStep
 *   - other roles   → forbidden
 */
export async function checkProjectAccess(
  session: AuthedSession,
  projectId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const role = session.effectiveRole;
  if (role === "admin" || role === "planner") {
    return { ok: true };
  }

  // Lazy import so this module stays light for callers that never need DB.
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
    return { ok: true };
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
    return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}

/**
 * Standalone variant that fetches the session and then runs
 * `checkProjectAccess`. Prefer `withProjectAuth` for new routes; this remains
 * available for helpers outside the route-handler shape.
 */
export async function requireProjectAccess(
  projectId: string
): Promise<
  | { ok: true; session: AuthedSession; projectId: string }
  | { ok: false; response: Response }
> {
  const session = await getSessionWithUser();
  if (!session.ok) return { ok: false, response: session.response };
  const access = await checkProjectAccess(session, projectId);
  if (!access.ok) return { ok: false, response: access.response };
  return { ok: true, session, projectId };
}

/**
 * Wrap a project-scoped route handler.
 *
 * The route must have `params.id` = project id (the convention across
 * `/api/projects/[id]/**`). Admin/planner short-circuit to the handler;
 * salesperson/woodworker must be tied to the project.
 */
export function withProjectAuth<P extends { id: string }>(
  policy: AuthPolicy,
  handler: (ctx: AuthedContext<P>) => Promise<Response> | Response
) {
  return withAuth<P>(policy, async (ctx) => {
    const projectId = ctx.params.id;
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }
    const access = await checkProjectAccess(ctx.session, projectId);
    if (!access.ok) return access.response;
    return handler(ctx);
  });
}
