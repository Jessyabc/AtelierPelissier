import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { distributorSchema } from "@/lib/validators";

/** GET: List all distributors, ordered by reference name */
export async function GET() {
  const list = await prisma.distributor.findMany({
    orderBy: { referenceName: "asc" },
  });
  return NextResponse.json(list);
}

/** POST: Create a new distributor */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = distributorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const distributor = await prisma.distributor.create({
    data: {
      referenceName: data.referenceName,
      companyName: data.companyName,
      phoneNumber: data.phoneNumber ?? null,
      extension: data.extension ?? null,
      accountNumber: data.accountNumber ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(distributor);
}
