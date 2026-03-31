import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const buildTime = process.env.VERCEL_GIT_COMMIT_DATE ?? null;
  const now = new Date().toISOString();

  let dbOk = false;
  let errorCount24h = 0;
  let authTablesOk = false;
  let authTablesError: string | null = null;
  let userCount: number | null = null;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    errorCount24h = await prisma.appErrorLog.count({
      where: { createdAt: { gte: since } },
    });

    try {
      userCount = await prisma.user.count();
      // also touch Invite to confirm schema exists
      await prisma.invite.count();
      authTablesOk = true;
    } catch (e) {
      authTablesOk = false;
      authTablesError = e instanceof Error ? e.message : String(e);
    }
  } catch {
    dbOk = false;
  }

  const status = dbOk && authTablesOk ? 200 : 503;

  return NextResponse.json(
    {
      status: dbOk && authTablesOk ? "healthy" : "degraded",
      db: dbOk ? "connected" : "unreachable",
      errorCount24h,
      authTables: authTablesOk ? "ok" : "error",
      authTablesError,
      userCount,
      commitSha,
      buildTime,
      timestamp: now,
    },
    { status }
  );
}
