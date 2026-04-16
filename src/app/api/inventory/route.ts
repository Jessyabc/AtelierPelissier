import { NextRequest, NextResponse } from "next/server";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getSessionWithUser, requireRole } from "@/lib/auth/session";

/**
 * GET: Inventory items with computed onHand, reserved, available.
 * POST: Create a new inventory item.
 */
export const dynamic = "force-dynamic";

const createItemSchema = z.object({
  materialCode: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(500).trim(),
  unit: z.string().max(50).trim().default("sheets"),
  onHand: z.number().min(0).default(0),
  minThreshold: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).default(0),
  reorderQty: z.number().min(0).default(0),
  costDefault: z.number().min(0).default(0),
  category: z.enum(["sheetGoods", "hardware", "finish", "delivery", "outsourced", "labor", "misc"]).default("sheetGoods"),
});

export async function GET() {
  const auth = await getSessionWithUser();
  if (!auth.ok) return auth.response;
  const [items, state] = await Promise.all([
    prisma.inventoryItem.findMany({
      orderBy: { materialCode: "asc" },
      include: { defaultSheetFormat: true, section: true },
    }),
    computeInventoryState(),
  ]);

  const stateByCode = Object.fromEntries(
    state.map((s) => [s.materialCode, s])
  );

  const enriched = items.map((item) => {
    const s = stateByCode[item.materialCode];
    return {
      ...item,
      onHand: s?.onHand ?? item.onHand ?? item.stockQty ?? 0,
      reservedQty: s?.reservedQty ?? 0,
      availableQty: s?.availableQty ?? 0,
      incomingQty: s?.incomingQty ?? 0,
      belowReorder: item.reorderPoint > 0 && (s?.onHand ?? item.onHand ?? 0) < item.reorderPoint,
      belowMin: (s?.onHand ?? item.onHand ?? 0) < item.minThreshold,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const postAuth = await requireRole(["admin", "planner"]);
  if (!postAuth.ok) return postAuth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.inventoryItem.findUnique({
    where: { materialCode: parsed.data.materialCode },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Material code already exists" }, { status: 409 });
  }

  const item = await prisma.inventoryItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
