import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** DELETE: Remove an item from the service call. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scId: string; itemId: string }> }
) {
  const { scId, itemId } = await params;

  const serviceCall = await prisma.serviceCall.findUnique({
    where: { id: scId },
    select: { id: true },
  });
  if (!serviceCall) {
    return NextResponse.json({ error: "Service call not found" }, { status: 404 });
  }

  await prisma.serviceCallItem.deleteMany({
    where: { id: itemId, serviceCallId: scId },
  });

  return NextResponse.json({ ok: true });
}
