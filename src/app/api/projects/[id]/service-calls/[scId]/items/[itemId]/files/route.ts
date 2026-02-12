import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/** POST: Upload a file for a materials item */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; scId: string; itemId: string }> }
) {
  const { id: projectId, scId, itemId } = await params;

  const item = await prisma.serviceCallItem.findFirst({
    where: {
      id: itemId,
      serviceCallId: scId,
      serviceCall: { projectId },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
  const ext = path.extname(fileName) || "";
  const baseName = path.basename(fileName, ext) || "file";
  const safeName = `${baseName}${ext}`.slice(0, 80);

  const fileId = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const storageDir = path.join(process.cwd(), "public", "uploads", "service-call-items", itemId);
  const storageName = `${fileId}-${safeName}`;
  const storagePath = path.join(storageDir, storageName);

  try {
    await mkdir(storageDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(storagePath, Buffer.from(bytes));
  } catch (err) {
    console.error("File write error:", err);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }

  const relativePath = `uploads/service-call-items/${itemId}/${storageName}`;

  const record = await prisma.serviceCallItemFile.create({
    data: {
      serviceCallItemId: itemId,
      fileName: file.name,
      storagePath: relativePath,
    },
  });

  return NextResponse.json(record);
}
