import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";

const createSchema = z.object({
  materialCode: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().default(""),
  stockQty: z.number().min(0).default(0),
  onHand: z.number().min(0).default(0),
  unit: z.string().max(20).trim().default("sheets"),
  minThreshold: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  reorderQty: z.number().min(0).default(0),
  costDefault: z.number().min(0).default(0),
  category: z.string().max(50).trim().default("sheetGoods"),
  defaultSheetFormatId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "50", 10) || 50);
  const where = q
    ? {
        OR: [
          { materialCode: { contains: q } },
          { description: { contains: q } },
        ],
      }
    : undefined;
  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { materialCode: "asc" },
    take: limit,
    select: { id: true, materialCode: true, description: true, unit: true },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const item = await prisma.inventoryItem.create({
    data: {
      ...data,
      onHand: data.onHand ?? data.stockQty ?? 0,
    },
  });
  return NextResponse.json(item);
}
