import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { costLineSchema } from "@/lib/validators";
import { triggerFinancialRecalc } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

// GET cost lines — any authenticated user. The Costs tab is already
// role-filtered in the UI (sales gets SalesProjectSummary instead of raw
// cost lines), so "any" here is just the authenticated-read baseline.
export const GET = withAuth<{ id: string }>("any", async ({ params }) => {
  const { id: projectId } = params;
  const lines = await prisma.costLine.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { category: "asc" }],
  });
  return NextResponse.json(lines);
});

// POST cost line — admin/planner only. Cost breakdown is not sales-touchable
// (see `canSeeKitchenCostBreakdown`).
export const POST = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id: projectId } = params;
    let body: unknown;
    try {
      body = await req.json();
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
    triggerFinancialRecalc(projectId);
    return NextResponse.json(line);
  }
);
