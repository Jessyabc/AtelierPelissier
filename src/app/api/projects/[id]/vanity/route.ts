import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { vanityInputsSchema } from "@/lib/validators";

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
  const parsed = vanityInputsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  await prisma.vanityInputs.upsert({
    where: { projectId },
    create: {
      projectId,
      width: data.width,
      depth: data.depth,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      numberOfSinks: data.numberOfSinks,
      doorStyle: data.doorStyle,
      countertop: data.countertop,
      countertopWidth: data.countertop ? data.countertopWidth ?? null : null,
      countertopDepth: data.countertop ? data.countertopDepth ?? null : null,
      sinks: data.countertop ? data.sinks ?? null : null,
      faucetHoles: data.countertop ? data.faucetHoles ?? null : null,
      priceRangePi2: data.countertop ? data.priceRangePi2 ?? null : null,
    },
    update: {
      width: data.width,
      depth: data.depth,
      kickplate: data.kickplate,
      framingStyle: data.framingStyle,
      mountingStyle: data.mountingStyle,
      drawers: data.drawers,
      doors: data.doors,
      thickFrame: data.thickFrame,
      numberOfSinks: data.numberOfSinks,
      doorStyle: data.doorStyle,
      countertop: data.countertop,
      countertopWidth: data.countertop ? data.countertopWidth ?? null : null,
      countertopDepth: data.countertop ? data.countertopDepth ?? null : null,
      sinks: data.countertop ? data.sinks ?? null : null,
      faucetHoles: data.countertop ? data.faucetHoles ?? null : null,
      priceRangePi2: data.countertop ? data.priceRangePi2 ?? null : null,
    },
  });
  await logAudit(projectId, "vanity_updated");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { vanityInputs: true },
  });
  return NextResponse.json(project?.vanityInputs ?? {});
}
