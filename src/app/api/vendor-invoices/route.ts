import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  supplierId: z.string().min(1),
  invoiceNumber: z.string().min(1).max(100).trim(),
  invoiceDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  fileUrl: z.string().max(500).optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const invoices = await prisma.vendorInvoice.findMany({
    include: { supplier: true, lines: true },
    orderBy: { invoiceDate: "desc" },
  });
  return NextResponse.json(invoices);
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
  const data = parsed.data;
  const invoiceDate = typeof data.invoiceDate === "string" ? new Date(data.invoiceDate) : data.invoiceDate;
  const invoice = await prisma.vendorInvoice.create({
    data: {
      supplierId: data.supplierId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate,
      fileUrl: data.fileUrl ?? null,
    },
    include: { supplier: true },
  });
  return NextResponse.json(invoice);
}
