import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getSessionWithUser, requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).trim().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET() {
  const auth = await getSessionWithUser();
  if (!auth.ok) return auth.response;

  const sections = await prisma.warehouseSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, sortOrder: true },
  });

  return NextResponse.json(sections);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
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

  try {
    const section = await prisma.warehouseSection.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
      select: { id: true, name: true, description: true, sortOrder: true },
    });
    return NextResponse.json(section, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create section";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

