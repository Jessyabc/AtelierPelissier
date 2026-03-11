/**
 * Cross-project borrowing analysis and execution.
 *
 * When project A needs material that project B has reserved but B has time slack,
 * allows loaning with automatic deviation warnings on both projects.
 */

import { prisma } from "@/lib/db";
import { upsertDeviation } from "@/lib/observability/deviations";

export type BorrowCandidate = {
  lenderProjectId: string;
  lenderProjectName: string;
  lenderJobNumber: string | null;
  allocatedQty: number;
  targetDate: Date | null;
  weeksUntilTarget: number;
  hasTimeSlack: boolean;
};

/**
 * Find projects that have allocated stock for a material and have enough time
 * slack to allow reordering after lending.
 */
export async function findBorrowCandidates(
  materialCode: string,
  excludeProjectId: string
): Promise<BorrowCandidate[]> {
  const item = await prisma.inventoryItem.findUnique({
    where: { materialCode },
  });
  if (!item) return [];

  const movements = await prisma.stockMovement.findMany({
    where: {
      inventoryItemId: item.id,
      type: { in: ["allocate", "consume"] },
      projectId: { not: excludeProjectId },
    },
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

  // Aggregate by project
  const byProject = new Map<string, { qty: number; project: NonNullable<(typeof movements)[0]["project"]> }>();
  for (const m of movements) {
    if (!m.project || m.project.isDone) continue;
    const prev = byProject.get(m.projectId!);
    byProject.set(m.projectId!, {
      qty: (prev?.qty ?? 0) + m.quantity,
      project: m.project,
    });
  }

  // Subtract deallocations/returns
  const returnMovements = await prisma.stockMovement.findMany({
    where: {
      inventoryItemId: item.id,
      type: { in: ["deallocate", "return"] },
      projectId: { not: excludeProjectId },
    },
  });
  for (const m of returnMovements) {
    if (!m.projectId) continue;
    const prev = byProject.get(m.projectId);
    if (prev) {
      prev.qty -= m.quantity;
    }
  }

  const now = new Date();
  const candidates: BorrowCandidate[] = [];

  for (const [, data] of Array.from(byProject.entries())) {
    if (data.qty <= 0) continue;

    const weeksUntilTarget = data.project.targetDate
      ? (data.project.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)
      : Infinity;

    // Has time slack if more than production delay + buffer weeks remain
    const productionWeeks = data.project.productionDelayWeeks ?? 10;
    const hasTimeSlack = weeksUntilTarget > productionWeeks + 2;

    candidates.push({
      lenderProjectId: data.project.id,
      lenderProjectName: data.project.name,
      lenderJobNumber: data.project.jobNumber,
      allocatedQty: data.qty,
      targetDate: data.project.targetDate,
      weeksUntilTarget: Math.round(weeksUntilTarget * 10) / 10,
      hasTimeSlack,
    });
  }

  return candidates.sort((a, b) => b.weeksUntilTarget - a.weeksUntilTarget);
}

/**
 * Execute a cross-project borrow:
 * 1. Deallocate from lender project
 * 2. Allocate to borrower project
 * 3. Create warning deviations on both projects
 */
export async function executeBorrow(params: {
  materialCode: string;
  quantity: number;
  lenderProjectId: string;
  borrowerProjectId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { materialCode, quantity, lenderProjectId, borrowerProjectId } = params;

  const item = await prisma.inventoryItem.findUnique({
    where: { materialCode },
  });
  if (!item) return { success: false, error: "Material not found" };

  const [lenderProject, borrowerProject] = await Promise.all([
    prisma.project.findUnique({ where: { id: lenderProjectId }, select: { name: true, jobNumber: true } }),
    prisma.project.findUnique({ where: { id: borrowerProjectId }, select: { name: true, jobNumber: true } }),
  ]);

  if (!lenderProject || !borrowerProject) return { success: false, error: "Project not found" };

  // Create deallocate movement for lender
  await prisma.stockMovement.create({
    data: {
      inventoryItemId: item.id,
      projectId: lenderProjectId,
      type: "deallocate",
      quantity,
      note: `Loaned to ${borrowerProject.jobNumber ?? borrowerProject.name}`,
    },
  });

  // Create allocate movement for borrower
  await prisma.stockMovement.create({
    data: {
      inventoryItemId: item.id,
      projectId: borrowerProjectId,
      type: "allocate",
      quantity,
      note: `Borrowed from ${lenderProject.jobNumber ?? lenderProject.name}`,
    },
  });

  // Warning on lender: "You loaned material, reorder needed"
  const lenderRef = borrowerProject.jobNumber ?? borrowerProject.name;
  await upsertDeviation({
    projectId: lenderProjectId,
    type: "inventory_shortage",
    severity: "medium",
    groupKey: `loan-${materialCode}-${borrowerProjectId}`,
    message: `Loaned ${quantity} ${item.unit} of ${materialCode} (${item.description}) to ${lenderRef} — reorder needed`,
    impactValue: quantity * item.costDefault,
  });

  // Warning on borrower: "Using borrowed material"
  const borrowerRef = lenderProject.jobNumber ?? lenderProject.name;
  await upsertDeviation({
    projectId: borrowerProjectId,
    type: "inventory_shortage",
    severity: "low",
    groupKey: `borrowed-${materialCode}-${lenderProjectId}`,
    message: `Using ${quantity} ${item.unit} of ${materialCode} (${item.description}) borrowed from ${borrowerRef}`,
    impactValue: 0,
  });

  return { success: true };
}
