import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.processTemplate.findUnique({
      where: { id },
      include: {
        steps: true,
        edges: true,
      },
    });
    if (!template) {
      return NextResponse.json({ error: "Process template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (err) {
    console.error("GET /api/process-templates/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to load process template" },
      { status: 500 }
    );
  }
}

type StepPayload = {
  id: string;
  label: string;
  description?: string | null;
  type: string;
  isOptional?: boolean;
  positionX: number;
  positionY: number;
};

type EdgePayload = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  conditionLabel?: string | null;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, description, steps, edges } = body as {
    name?: string;
    description?: string | null;
    steps?: StepPayload[];
    edges?: EdgePayload[];
  };

  const existing = await prisma.processTemplate.findUnique({
    where: { id },
    include: { steps: true, edges: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Process template not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update template metadata
      await tx.processTemplate.update({
        where: { id },
        data: {
          ...(name != null && { name: String(name).trim() }),
          ...(description !== undefined && {
            description: typeof description === "string" ? description.trim() || null : null,
          }),
        },
      });

      const incomingSteps = Array.isArray(steps) ? steps : [];
      const incomingEdges = Array.isArray(edges) ? edges : [];
      const incomingStepIds = new Set(incomingSteps.map((s) => s.id));
      const incomingEdgeIds = new Set(incomingEdges.map((e) => e.id));

      // Delete steps not in payload
      const stepsToDelete = existing.steps.filter((s) => !incomingStepIds.has(s.id));
      if (stepsToDelete.length > 0) {
        await tx.processStep.deleteMany({
          where: { id: { in: stepsToDelete.map((s) => s.id) } },
        });
      }

      // Delete edges not in payload
      const edgesToDelete = existing.edges.filter((e) => !incomingEdgeIds.has(e.id));
      if (edgesToDelete.length > 0) {
        await tx.processStepEdge.deleteMany({
          where: { id: { in: edgesToDelete.map((e) => e.id) } },
        });
      }

      // Upsert steps
      for (const s of incomingSteps) {
        const data = {
          templateId: id,
          label: String(s.label || "Step").trim(),
          description: typeof s.description === "string" ? s.description.trim() || null : null,
          type: ["start", "step", "decision", "end"].includes(String(s.type)) ? s.type : "step",
          isOptional: Boolean(s.isOptional),
          positionX: Number(s.positionX) || 0,
          positionY: Number(s.positionY) || 0,
        };
        const existingStep = existing.steps.find((x) => x.id === s.id);
        if (existingStep) {
          await tx.processStep.update({
            where: { id: s.id },
            data,
          });
        } else {
          await tx.processStep.create({
            data: { id: s.id, ...data },
          });
        }
      }

      // Upsert edges
      for (const e of incomingEdges) {
        if (!incomingStepIds.has(e.sourceStepId) || !incomingStepIds.has(e.targetStepId)) {
          continue; // Skip if source or target step doesn't exist
        }
        const data = {
          templateId: id,
          sourceStepId: e.sourceStepId,
          targetStepId: e.targetStepId,
          conditionLabel:
            typeof e.conditionLabel === "string" ? e.conditionLabel.trim() || null : null,
        };
        const existingEdge = existing.edges.find((x) => x.id === e.id);
        if (existingEdge) {
          await tx.processStepEdge.update({
            where: { id: e.id },
            data,
          });
        } else {
          await tx.processStepEdge.create({
            data: { id: e.id, ...data },
          });
        }
      }
    });

    const updated = await prisma.processTemplate.findUnique({
      where: { id },
      include: { steps: true, edges: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/process-templates/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update process template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const existing = await prisma.processTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Process template not found" }, { status: 404 });
    }
    await prisma.processTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/process-templates/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete process template" },
      { status: 500 }
    );
  }
}
