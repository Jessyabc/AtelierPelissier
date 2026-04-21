import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET: Check whether the last recalculation for a project encountered any errors.
 * Returns { ok: true } if no recent unresolved recalc errors, or
 * { ok: false, error, failedAt } if one exists.
 * Used by the project detail page to show a "stale data" warning banner —
 * any authenticated user viewing the project needs to see the banner.
 */
export const GET = withAuth<{ id: string }>("any", async ({ params }) => {
  const { id: projectId } = params;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentError = await prisma.appErrorLog.findFirst({
    where: {
      resolved: false,
      route: `/api/projects/${projectId}/recalculate`,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, createdAt: true },
  });

  if (!recentError) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({
    ok: false,
    error: recentError.message,
    failedAt: recentError.createdAt,
    errorLogId: recentError.id,
  });
});

/**
 * POST: Manually trigger a recalculation and return the result synchronously.
 * Used by the "Retry recalculation" button on the project page. Admin/planner
 * only — retrying is a planner concern and aligns with /recalculate's policy.
 */
export const POST = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId } = params;

    try {
      const { recalculateProjectState } = await import("@/lib/observability/recalculateProjectState");
      await recalculateProjectState(projectId);

      await prisma.appErrorLog.updateMany({
        where: {
          resolved: false,
          route: `/api/projects/${projectId}/recalculate`,
        },
        data: { resolved: true },
      });

      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Recalculation failed" },
        { status: 500 }
      );
    }
  }
);
