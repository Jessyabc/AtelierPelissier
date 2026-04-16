import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { getSessionWithUser } from "@/lib/auth/session";

/**
 * GET /api/ops/impact-analysis?materialCode=XXX&shortfall=N
 * Analyzes the impact of a material shortage and suggests options:
 * - Which projects are affected
 * - Can we borrow from another project
 * - Should we reorder
 */
export async function GET(req: NextRequest) {
  const auth = await getSessionWithUser();
  if (!auth.ok) return auth.response;
  const materialCode = req.nextUrl.searchParams.get("materialCode");
  const shortfallParam = req.nextUrl.searchParams.get("shortfall");

  if (!materialCode) {
    return NextResponse.json({ error: "materialCode required" }, { status: 400 });
  }

  const shortfall = parseFloat(shortfallParam ?? "0");

  // Get inventory state for this material
  const [invState] = await computeInventoryState([materialCode]);

  // Get all project requirements for this material
  const requirements = await prisma.materialRequirement.findMany({
    where: { materialCode },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          jobNumber: true,
          targetDate: true,
          productionDelayWeeks: true,
          isDone: true,
        },
      },
    },
  });

  // Get stock movements (allocations) per project
  const item = await prisma.inventoryItem.findUnique({
    where: { materialCode },
    include: {
      movements: {
        where: { type: { in: ["allocate", "consume"] } },
        include: { project: { select: { id: true, name: true, jobNumber: true, targetDate: true } } },
      },
    },
  });

  // Identify projects that could lend material (have allocations and time slack)
  const now = new Date();
  const borrowOptions: {
    projectId: string;
    projectName: string;
    jobNumber: string | null;
    allocatedQty: number;
    targetDate: string | null;
    hasTimeSlack: boolean;
  }[] = [];

  if (item) {
    // Sum allocations per project
    const allocByProject = new Map<string, { qty: number; name: string; jobNumber: string | null; targetDate: Date | null }>();
    for (const m of item.movements) {
      if (!m.projectId || !m.project) continue;
      const prev = allocByProject.get(m.projectId);
      allocByProject.set(m.projectId, {
        qty: (prev?.qty ?? 0) + m.quantity,
        name: m.project.name,
        jobNumber: m.project.jobNumber,
        targetDate: m.project.targetDate,
      });
    }

    for (const [projId, data] of Array.from(allocByProject.entries())) {
      if (data.qty <= 0) continue;
      // Check if this project has time slack (target date is far enough to reorder)
      const hasTimeSlack = data.targetDate
        ? (data.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7) > 10
        : false;

      borrowOptions.push({
        projectId: projId,
        projectName: data.name,
        jobNumber: data.jobNumber,
        allocatedQty: data.qty,
        targetDate: data.targetDate?.toISOString() ?? null,
        hasTimeSlack,
      });
    }
  }

  const affectedProjects = requirements
    .filter((r) => !r.project.isDone)
    .map((r) => ({
      id: r.project.id,
      name: r.project.name,
      jobNumber: r.project.jobNumber,
      requiredQty: r.requiredQty,
      allocatedQty: r.allocatedQty,
      gap: Math.max(0, r.requiredQty - r.allocatedQty),
      targetDate: r.project.targetDate?.toISOString() ?? null,
    }));

  return NextResponse.json({
    materialCode,
    shortfall,
    inventoryState: invState ?? null,
    affectedProjects,
    borrowOptions: borrowOptions.filter((b) => b.hasTimeSlack),
    recommendation: shortfall > 0
      ? borrowOptions.some((b) => b.hasTimeSlack && b.allocatedQty >= shortfall)
        ? "borrow"
        : "reorder"
      : "none",
  });
}
