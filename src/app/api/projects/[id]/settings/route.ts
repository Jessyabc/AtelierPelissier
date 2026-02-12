import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { projectSettingsSchema } from "@/lib/validators";

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
  const parsed = projectSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { markup, taxEnabled, taxRate, sheetFormatId } = parsed.data;

  await prisma.projectSettings.upsert({
    where: { projectId },
    create: {
      projectId,
      markup,
      taxEnabled,
      taxRate,
      sheetFormatId: sheetFormatId ?? null,
    },
    update: {
      markup,
      taxEnabled,
      taxRate,
      sheetFormatId: sheetFormatId ?? undefined,
    },
  });
  await logAudit(projectId, "settings_updated");

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
    include: { sheetFormat: true },
  });
  return NextResponse.json(settings ?? {});
}
