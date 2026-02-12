import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { costLineUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: projectId, lineId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = costLineUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const line = await prisma.costLine.update({
    where: { id: lineId },
    data: {
      ...(data.kind != null && { kind: data.kind }),
      ...(data.category != null && { category: data.category }),
      ...(data.amount != null && { amount: data.amount }),
    },
  });
  await logAudit(projectId, "cost_updated");
  return NextResponse.json(line);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: projectId, lineId } = await params;
  await prisma.costLine.delete({ where: { id: lineId } });
  await logAudit(projectId, "cost_deleted");
  return NextResponse.json({ ok: true });
}
