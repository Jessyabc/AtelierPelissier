import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";
import { withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; scId: string; itemId: string; fileId: string };

/**
 * DELETE: Remove a file from a service-call materials item.
 * Sales-touchable (service calls are sales-owned workflow).
 */
export const DELETE = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ params }) => {
    const { scId, itemId, fileId } = params;

    const fileRecord = await prisma.serviceCallItemFile.findFirst({
      where: {
        id: fileId,
        serviceCallItemId: itemId,
        serviceCallItem: {
          serviceCallId: scId,
        },
      },
    });
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fullPath = path.join(process.cwd(), "public", fileRecord.storagePath);
    try {
      await unlink(fullPath);
    } catch {
      // File may already be missing; proceed with DB delete
    }

    await prisma.serviceCallItemFile.delete({ where: { id: fileId } });
    return NextResponse.json({ ok: true });
  }
);
