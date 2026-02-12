import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
