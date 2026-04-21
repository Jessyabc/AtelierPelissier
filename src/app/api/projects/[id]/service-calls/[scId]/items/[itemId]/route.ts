import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; scId: string; itemId: string };

/**
 * DELETE: Remove an item from the service call.
 * Sales-touchable (service calls are sales-owned workflow).
 */
export const DELETE = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ params }) => {
    const { scId, itemId } = params;

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
);
