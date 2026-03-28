import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const buildTime = process.env.VERCEL_GIT_COMMIT_DATE ?? null;
  const now = new Date().toISOString();

  let dbOk = false;
  let errorCount24h = 0;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    errorCount24h = await prisma.appErrorLog.count({
      where: { createdAt: { gte: since } },
    });
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status: dbOk ? "healthy" : "degraded",
      db: dbOk ? "connected" : "unreachable",
      errorCount24h,
      commitSha,
      buildTime,
      timestamp: now,
    },
    { status }
  );
}
