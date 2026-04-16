import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  description: z.string().max(500).trim().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
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

  const existing = await prisma.warehouseSection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const section = await prisma.warehouseSection.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, description: true, sortOrder: true },
  });
  return NextResponse.json(section);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const existing = await prisma.warehouseSection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  // onDelete: SetNull on InventoryItem.section, so deleting a section just unassigns items.
  await prisma.warehouseSection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

