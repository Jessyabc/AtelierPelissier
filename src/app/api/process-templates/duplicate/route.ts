import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Generate unique id for duplicated steps/edges
function makeId(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sourceId =
    typeof body === "object" && body !== null && "sourceId" in body
      ? (body as { sourceId: string }).sourceId
      : null;
  if (!sourceId || typeof sourceId !== "string") {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const source = await prisma.processTemplate.findUnique({
    where: { id: sourceId },
    include: { steps: true, edges: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Process template not found" }, { status: 404 });
  }

  try {
    const newName = `${source.name} (copy)`;
    const template = await prisma.processTemplate.create({
      data: {
        name: newName,
        description: source.description,
      },
    });

    const oldToNewStepId: Record<string, string> = {};
    for (const s of source.steps) {
      const newId = makeId();
      oldToNewStepId[s.id] = newId;
      await prisma.processStep.create({
        data: {
          id: newId,
          templateId: template.id,
          label: s.label,
          description: s.description,
          type: s.type,
          isOptional: s.isOptional,
          positionX: s.positionX,
          positionY: s.positionY,
        },
      });
    }

    for (const e of source.edges) {
      const newSourceId = oldToNewStepId[e.sourceStepId];
      const newTargetId = oldToNewStepId[e.targetStepId];
      if (newSourceId && newTargetId) {
        await prisma.processStepEdge.create({
          data: {
            id: makeId(),
            templateId: template.id,
            sourceStepId: newSourceId,
            targetStepId: newTargetId,
            conditionLabel: e.conditionLabel,
          },
        });
      }
    }

    const full = await prisma.processTemplate.findUnique({
      where: { id: template.id },
      include: { steps: true, edges: true },
    });
    return NextResponse.json(full);
  } catch (err) {
    console.error("POST /api/process-templates/duplicate error:", err);
    return NextResponse.json(
      { error: "Failed to duplicate process template" },
      { status: 500 }
    );
  }
}
