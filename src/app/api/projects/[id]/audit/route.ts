import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";

// Audit log is a history / compliance surface — planner + admin only.
// (Salespeople don't need to see who changed what on a project.)
export const GET = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ params }) => {
    try {
      const { id } = params;
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const logs = await prisma.auditLog.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return NextResponse.json(logs);
    } catch (err) {
      console.error("GET /api/projects/[id]/audit error:", err);
      return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
    }
  }
);
