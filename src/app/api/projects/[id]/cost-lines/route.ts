import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { costLineSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const lines = await prisma.costLine.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { category: "asc" }],
  });
  return NextResponse.json(lines);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = costLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { kind, category, amount } = parsed.data;

  const line = await prisma.costLine.create({
    data: { projectId, kind, category, amount },
  });
  await logAudit(projectId, "cost_added", `${kind}: ${category} $${amount}`);
  return NextResponse.json(line);
}
