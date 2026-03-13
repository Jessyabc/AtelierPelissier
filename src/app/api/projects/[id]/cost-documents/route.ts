import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/cost-documents
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const docs = await prisma.costDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

// POST /api/projects/[id]/cost-documents
// Accepts multipart/form-data with:
// - file: the uploaded document
// - type: reservation | supplier_invoice | estimate | sage_invoice | other
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string | null)?.trim() || "other";

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "File is required" },
      { status: 400 }
    );
  }

  // Persist file under public/uploads/cost-docs
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "cost-docs");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name || "") || "";
  const safeBase = (file.name || "document")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 80);
  const fileName = `${Date.now()}-${safeBase}${ext}`;
  const fullPath = path.join(uploadsDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  const storagePath = path.join("uploads", "cost-docs", fileName).replace(/\\/g, "/");

  // For now, we don't deeply parse; we store minimal metadata.
  const doc = await prisma.costDocument.create({
    data: {
      projectId,
      type,
      sourceName: file.name || fileName,
      storagePath,
      invoiceNumber: null,
      parsedJson: null,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}

