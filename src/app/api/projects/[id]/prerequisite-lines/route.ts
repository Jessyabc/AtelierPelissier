import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { prerequisiteLineSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

export const GET = withAuth<{ id: string }>("any", async ({ req, params }) => {
  const { id: projectId } = params;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const where: { projectId: string; category?: string } = { projectId };
  if (category) where.category = category;

  const lines = await prisma.prerequisiteLine.findMany({
    where,
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const materialCodes = [...new Set(lines.map((l) => l.materialCode).filter(Boolean))];
  const inventoryByCode = await prisma.inventoryItem
    .findMany({
      where: { materialCode: { in: materialCodes } },
      select: { materialCode: true, description: true, unit: true },
    })
    .then((items) => new Map(items.map((i) => [i.materialCode, i])));

  const withDescription = lines.map((line) => ({
    ...line,
    description: inventoryByCode.get(line.materialCode)?.description ?? null,
    unit: inventoryByCode.get(line.materialCode)?.unit ?? null,
  }));

  return NextResponse.json(withDescription);
});

export const POST = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ req, params }) => {
  const { id: projectId } = params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = prerequisiteLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const maxOrder = await prisma.prerequisiteLine
    .aggregate({
      where: { projectId, category: data.category },
      _max: { sortOrder: true },
    })
    .then((r) => r._max.sortOrder ?? -1);

  const line = await prisma.prerequisiteLine.create({
    data: {
      projectId,
      materialCode: data.materialCode,
      category: data.category,
      quantity: data.quantity,
      needed: data.needed ?? true,
      sortOrder: maxOrder + 1,
    },
  });
  triggerMaterialInventoryOrderRecalc(projectId);
  return NextResponse.json(line);
  }
);
