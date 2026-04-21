import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { costLineUpdateSchema } from "@/lib/validators";
import { triggerFinancialRecalc } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

type LineParams = { id: string; lineId: string };

export const PATCH = withAuth<LineParams>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id: projectId, lineId } = params;
    let body: unknown;
    try {
      body = await req.json();
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
    triggerFinancialRecalc(projectId);
    return NextResponse.json(line);
  }
);

export const DELETE = withAuth<LineParams>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId, lineId } = params;
    await prisma.costLine.delete({ where: { id: lineId } });
    await logAudit(projectId, "cost_deleted");
    triggerFinancialRecalc(projectId);
    return NextResponse.json({ ok: true });
  }
);
