import { prisma } from "@/lib/db";

/**
 * Returns ordered step labels from a process template for seeding checklist items.
 * Excludes start/end nodes; includes step + decision (and any other middle nodes).
 * Ordered by flowchart layout (positionY then positionX).
 * Returns null if template not found.
 */
export async function getOrderedStepLabels(
  processTemplateId: string
): Promise<string[] | null> {
  const template = await prisma.processTemplate.findUnique({
    where: { id: processTemplateId },
    include: {
      steps: {
        orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
      },
    },
  });
  if (!template) return null;
  const t = (s: string) => s.trim().toLowerCase();
  return template.steps
    .filter((s) => {
      const ty = t(s.type);
      return ty !== "start" && ty !== "end";
    })
    .map((s) => s.label)
    .filter(Boolean);
}
