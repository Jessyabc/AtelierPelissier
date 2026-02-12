import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  descriptionRaw: z.string().min(1).max(500).trim(),
  qty: z.number().min(0).default(1),
  unitCost: z.number().min(0),
  mappedInventoryItemId: z.string().optional().nullable(),
  mappedProjectId: z.string().optional().nullable(),
  mappedCategory: z.string().min(1).max(50).trim(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
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

  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const data = parsed.data;
  const line = await prisma.vendorInvoiceLine.create({
    data: {
      invoiceId,
      descriptionRaw: data.descriptionRaw,
      qty: data.qty ?? 1,
      unitCost: data.unitCost,
      mappedInventoryItemId: data.mappedInventoryItemId ?? null,
      mappedProjectId: data.mappedProjectId ?? null,
      mappedCategory: data.mappedCategory,
    },
  });
  return NextResponse.json(line);
}
