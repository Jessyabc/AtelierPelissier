import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? "severity";

  const deviations = await prisma.deviation.findMany({
    where: { resolved: false },
    include: { project: { select: { id: true, name: true } } },
  });

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const typeOrder: Record<string, number> = {
    timeline_risk: 0,
    margin_risk: 1,
    cost_overrun: 2,
    inventory_shortage: 3,
    order_delay: 4,
  };

  const sorted = [...deviations].sort((a, b) => {
    if (sort === "impactValue") {
      const av = a.impactValue ?? 0;
      const bv = b.impactValue ?? 0;
      return bv - av;
    }
    if (sort === "severity") {
      const as = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
      const bs = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;
      if (as !== bs) return as - bs;
      return (b.impactValue ?? 0) - (a.impactValue ?? 0);
    }
    return 0;
  });

  return NextResponse.json(sorted);
}
