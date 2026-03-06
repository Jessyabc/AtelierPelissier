import { prisma } from "@/lib/db";

/**
 * Returns ordered step labels from a process template for seeding checklist items.
 * Uses type="step" only, ordered by positionY then positionX (flowchart layout order).
 * Returns null if template not found.
 */
export async function getOrderedStepLabels(
  processTemplateId: string
): Promise<string[] | null> {
  const template = await prisma.processTemplate.findUnique({
    where: { id: processTemplateId },
    include: {
      steps: {
        where: { type: "step" },
        orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
      },
    },
  });
  if (!template) return null;
  return template.steps.map((s) => s.label).filter(Boolean);
}
