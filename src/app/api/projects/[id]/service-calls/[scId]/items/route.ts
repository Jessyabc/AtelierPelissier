import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serviceCallItemSchema } from "@/lib/validators";

/** POST: Add an item to the service call. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; scId: string }> }
) {
  const { id: projectId, scId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = serviceCallItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { description, quantity, providedBy } = parsed.data;

  const serviceCall = await prisma.serviceCall.findFirst({
    where: { id: scId, projectId },
  });
  if (!serviceCall) {
    return NextResponse.json({ error: "Service call not found" }, { status: 404 });
  }

  const item = await prisma.serviceCallItem.create({
    data: {
      serviceCallId: serviceCall.id,
      description,
      quantity: quantity ?? null,
      providedBy: providedBy ?? null,
    },
  });

  return NextResponse.json(item);
}
