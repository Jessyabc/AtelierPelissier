import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET: Homepage stats — aggregated counts and ratios for dashboard.
 * Optimized for quick load; no full project lists.
 */
export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      projectCounts,
      serviceCallStats,
      calendarToday,
      distributorCount,
      orderStats,
      deviationStats,
      estimateTotal,
] = await Promise.all([
      prisma.project.groupBy({
        by: ["isDraft"],
        _count: { id: true },
      }),
      prisma.serviceCall.findMany({
        select: {
          id: true,
          serviceDate: true,
          serviceCompleted: true,
        },
      }),
      Promise.all([
        prisma.calendarEvent.count({
          where: { eventDate: { gte: todayStart, lte: todayEnd } },
        }),
        prisma.serviceCall.count({
          where: {
            serviceDate: { gte: todayStart, lte: todayEnd },
          },
        }),
      ]).then(([a, b]) => a + b),
      prisma.distributor.count(),
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.deviation.groupBy({
        by: ["severity", "resolved"],
        where: { resolved: false },
        _count: { id: true },
      }),
      prisma.costLine.aggregate({
        where: { kind: "estimate" },
        _sum: { amount: true },
      }),
    ]);

    const drafts =
      projectCounts.find((p) => p.isDraft)?._count?.id ?? 0;
    const saved =
      projectCounts.find((p) => !p.isDraft)?._count?.id ?? 0;
    const totalProjects = drafts + saved;

    const totalServiceCalls = serviceCallStats.length;
    const completedServiceCalls =
      serviceCallStats.filter((s) => s.serviceCompleted === true).length;
    const upcomingServiceCalls = serviceCallStats.filter(
      (s) => s.serviceDate && new Date(s.serviceDate) >= todayStart && new Date(s.serviceDate) <= weekEnd
    ).length;

    const orderByStatus = Object.fromEntries(
      orderStats.map((o) => [o.status, o._count.id])
    );
    const totalOrders = orderStats.reduce((s, o) => s + o._count.id, 0);
    const openOrders = totalOrders - (orderByStatus.received ?? 0);

    const deviationsBySeverity = deviationStats.reduce(
      (acc, d) => {
        acc[d.severity] = (acc[d.severity] ?? 0) + d._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
    const totalDeviations = Object.values(deviationsBySeverity).reduce(
      (a, b) => a + b,
      0
    );

    const totalEstimateValue = estimateTotal._sum?.amount ?? 0;

    return NextResponse.json({
      projects: {
        total: totalProjects,
        drafts,
        saved,
        draftPercent: totalProjects > 0 ? (drafts / totalProjects) * 100 : 0,
        savedPercent: totalProjects > 0 ? (saved / totalProjects) * 100 : 0,
      },
      serviceCalls: {
        total: totalServiceCalls,
        completed: completedServiceCalls,
        completedPercent:
          totalServiceCalls > 0
            ? (completedServiceCalls / totalServiceCalls) * 100
            : 0,
        upcomingThisWeek: upcomingServiceCalls,
      },
      calendar: {
        eventsToday: calendarToday,
      },
      distributors: {
        count: distributorCount,
      },
      orders: {
        total: totalOrders,
        open: openOrders,
        byStatus: orderByStatus,
      },
      deviations: {
        total: totalDeviations,
        bySeverity: deviationsBySeverity,
      },
      estimates: {
        totalValue: totalEstimateValue,
      },
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}
