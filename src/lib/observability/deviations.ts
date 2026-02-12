/**
 * Deviation upsert helper – deduplication: update existing or create new.
 */

import { prisma } from "@/lib/db";

export type DeviationInput = {
  projectId: string | null;
  type: string;
  severity: string;
  groupKey: string | null;
  message: string;
  impactValue?: number | null;
};

/**
 * Resolve deviations matching (projectId, type, groupKey) when condition clears.
 */
export async function resolveDeviation(
  projectId: string | null,
  type: string,
  groupKey: string | null
): Promise<void> {
  await prisma.deviation.updateMany({
    where: {
      resolved: false,
      projectId: projectId ?? undefined,
      type,
      groupKey: groupKey ?? undefined,
    },
    data: { resolved: true },
  });
}

/**
 * Find unresolved deviation with same (projectId, type, groupKey).
 * If exists: update severity, message, impactValue.
 * Else: create new.
 */
export async function upsertDeviation(input: DeviationInput): Promise<void> {
  const { projectId, type, severity, groupKey, message, impactValue } = input;

  const existing = await prisma.deviation.findFirst({
    where: {
      resolved: false,
      projectId: projectId ?? undefined,
      type,
      groupKey: groupKey ?? undefined,
    },
  });

  if (existing) {
    await prisma.deviation.update({
      where: { id: existing.id },
      data: { severity, message, impactValue: impactValue ?? null },
    });
  } else {
    await prisma.deviation.create({
      data: {
        projectId,
        type,
        severity,
        groupKey,
        message,
        impactValue: impactValue ?? null,
      },
    });
  }
}
