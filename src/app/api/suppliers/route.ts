import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  contactInfo: z.string().max(500).trim().optional().nullable(),
  notes: z.string().max(2000).trim().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
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
  const supplier = await prisma.supplier.create({ data: parsed.data });
  return NextResponse.json(supplier);
}
