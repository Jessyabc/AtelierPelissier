import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerOrderInventoryRecalc } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

const updateSchema = z.object({
  supplier: z.string().min(1).max(200).trim().optional(),
  supplierId: z.string().optional().nullable(),
  status: z.enum(["draft", "placed", "received", "partial", "cancelled"]).optional(),
  projectId: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  placedAt: z.string().datetime().optional().nullable(),
  leadTimeDays: z.number().int().min(0).optional().nullable(),
  backorderExpectedDate: z.string().datetime().optional().nullable(),
  backorderNotes: z.string().max(500).optional().nullable(),
});

/**
 * PATCH: Update a purchase order. Admin/planner only.
 */
export const PATCH = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id } = params;
    let body: unknown;
    try {
      body = await req.json();
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
    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.supplier !== undefined) updateData.supplier = data.supplier;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.expectedDeliveryDate !== undefined)
      updateData.expectedDeliveryDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;
    if (data.placedAt !== undefined)
      updateData.placedAt = data.placedAt ? new Date(data.placedAt) : null;
    if (data.leadTimeDays !== undefined) updateData.leadTimeDays = data.leadTimeDays;
    if (data.backorderExpectedDate !== undefined)
      updateData.backorderExpectedDate = data.backorderExpectedDate ? new Date(data.backorderExpectedDate) : null;
    if (data.backorderNotes !== undefined)
      updateData.backorderNotes = data.backorderNotes?.trim() || null;

    // When status changes to placed, set placedAt if not already recorded
    if (data.status === "placed") {
      const existing = await prisma.order.findUnique({ where: { id }, select: { placedAt: true } });
      if (existing && !existing.placedAt) updateData.placedAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
    });
    triggerOrderInventoryRecalc(order.projectId);
    return NextResponse.json(order);
  }
);
