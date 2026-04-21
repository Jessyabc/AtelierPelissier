import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serviceCallItemSchema } from "@/lib/validators";
import { withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; scId: string };

/**
 * POST: Add an item to the service call.
 * Sales-touchable (service calls are sales-owned workflow).
 */
export const POST = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
    const { id: projectId, scId } = params;

    let body: unknown;
    try {
      body = await req.json();
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
);
