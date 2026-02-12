import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";

const updateSchema = z.object({
  supplier: z.string().min(1).max(200).trim().optional(),
  supplierId: z.string().optional().nullable(),
  status: z.enum(["draft", "placed", "received", "partial", "cancelled"]).optional(),
  projectId: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
});

export async function PATCH(
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const order = await prisma.order.update({
    where: { id },
    data: parsed.data,
  });
  triggerOrderInventoryRecalc(order.projectId);
  return NextResponse.json(order);
}
