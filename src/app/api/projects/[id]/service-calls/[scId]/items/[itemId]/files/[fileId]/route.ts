import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";

/** DELETE: Remove a file from a materials item */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scId: string; itemId: string; fileId: string }> }
) {
  const { scId, itemId, fileId } = await params;

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
    // File may already be missing, continue with DB delete
  }

  await prisma.serviceCallItemFile.delete({ where: { id: fileId } });
  return NextResponse.json({ ok: true });
}
