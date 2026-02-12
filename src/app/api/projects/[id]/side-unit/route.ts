import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sideUnitInputsSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sideUnitInputsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  await prisma.sideUnitInputs.upsert({
    where: { projectId },
    create: {
      projectId,
      width: data.width,
      depth: data.depth,
      height: data.height,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      doorStyle: data.doorStyle,
    },
    update: {
      width: data.width,
      depth: data.depth,
      height: data.height,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      doorStyle: data.doorStyle,
    },
  });
  await logAudit(projectId, "side_unit_updated");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { sideUnitInputs: true },
  });
  return NextResponse.json(project?.sideUnitInputs ?? {});
}
