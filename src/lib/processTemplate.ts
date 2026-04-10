import type { ProcessStep } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Same filter as room checklists: include step + decision; exclude only start/end. */
function isExecutableFlowNode(stepType: string): boolean {
  const ty = stepType.trim().toLowerCase();
  return ty !== "start" && ty !== "end";
}

/**
 * Ordered flowchart nodes for a template (excluding start/end).
 * Used for room checklist labels and Production tab seeding — must stay in sync.
 */
export async function getOrderedTemplateSteps(
  processTemplateId: string
): Promise<ProcessStep[] | null> {
  const template = await prisma.processTemplate.findUnique({
    where: { id: processTemplateId },
    include: {
      steps: {
        orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
      },
    },
  });
  if (!template) return null;
  return template.steps.filter((s) => isExecutableFlowNode(s.type));
}

/**
 * Returns ordered step labels from a process template for seeding checklist items.
 * Excludes start/end nodes; includes step + decision (and any other middle nodes).
 * Returns null if template not found.
 */
export async function getOrderedStepLabels(
  processTemplateId: string
): Promise<string[] | null> {
  const steps = await getOrderedTemplateSteps(processTemplateId);
  if (steps === null) return null;
  return steps.map((s) => s.label).filter(Boolean);
}
