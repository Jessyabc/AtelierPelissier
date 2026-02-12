import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { distributorUpdateSchema } from "@/lib/validators";

/** PATCH: Update a distributor */
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

  const parsed = distributorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const distributor = await prisma.distributor.update({
    where: { id },
    data: {
      ...(data.referenceName !== undefined && { referenceName: data.referenceName }),
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
      ...(data.extension !== undefined && { extension: data.extension }),
      ...(data.accountNumber !== undefined && { accountNumber: data.accountNumber }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return NextResponse.json(distributor);
}

/** DELETE: Remove a distributor */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.distributor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
