import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const resolved = url.searchParams.get("resolved");
  const limit = parseInt(url.searchParams.get("limit") ?? "50");

  const where: Record<string, unknown> = {};
  if (resolved === "true") where.resolved = true;
  else if (resolved === "false") where.resolved = false;

  const errors = await prisma.appErrorLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(errors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const error = await prisma.appErrorLog.create({
    data: {
      source: body.source ?? "client",
      severity: body.severity ?? "error",
      message: body.message ?? "Unknown error",
      stack: body.stack ?? null,
      route: body.route ?? null,
      context: body.context ? JSON.stringify(body.context) : null,
    },
  });

  return NextResponse.json(error, { status: 201 });
}
