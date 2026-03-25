import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";

/**
 * GET /api/ai/conversations?projectId=XXX&scope=project
 * List AI conversations, optionally filtered by project or scope.
 */
export async function GET(req: NextRequest) {
  const auth = await getSessionWithUser();
  if (!auth.ok) return auth.response;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const scope = req.nextUrl.searchParams.get("scope");

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (scope) where.scope = scope;

  const conversations = await prisma.aiConversation.findMany({
    where,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      project: { select: { name: true, jobNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(conversations);
}
