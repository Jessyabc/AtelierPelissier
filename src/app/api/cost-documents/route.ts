import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/db";

const DOC_TYPES = ["reservation", "supplier_invoice", "estimate", "sage_invoice", "other"] as const;

/**
 * GET /api/cost-documents
 * Query: projectId (optional) — if "misc" or omitted, include docs with no project; if a project id, filter to that project only.
 * Returns all cost documents (optionally filtered), with project relation for display.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectIdParam = searchParams.get("projectId");

  const where: { projectId?: string | null } = {};
  if (projectIdParam != null && projectIdParam !== "" && projectIdParam !== "misc") {
    where.projectId = projectIdParam;
  } else if (projectIdParam === "misc") {
    where.projectId = null;
  }

  const docs = await prisma.costDocument.findMany({
    where,
    include: { project: { select: { id: true, name: true, jobNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

/**
 * POST /api/cost-documents
 * Multipart: file, type, projectId (optional — omit or "misc" for miscellaneous).
 * Creates a cost document and stores the file under public/uploads/cost-docs.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const typeRaw = (formData.get("type") as string | null)?.trim() || "other";
  const type = DOC_TYPES.includes(typeRaw as (typeof DOC_TYPES)[number]) ? typeRaw : "other";
  const projectIdRaw = formData.get("projectId") as string | null;
  const projectId = projectIdRaw?.trim() && projectIdRaw !== "misc" ? projectIdRaw.trim() : null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "cost-docs");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name || "") || "";
  const safeBase = (file.name || "document").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  const fileName = `${Date.now()}-${safeBase}${ext}`;
  const fullPath = path.join(uploadsDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  const storagePath = path.join("uploads", "cost-docs", fileName).replace(/\\/g, "/");

  const doc = await prisma.costDocument.create({
    data: {
      projectId,
      type,
      sourceName: file.name || fileName,
      storagePath,
      invoiceNumber: null,
      parsedJson: null,
    },
    include: { project: { select: { id: true, name: true, jobNumber: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
