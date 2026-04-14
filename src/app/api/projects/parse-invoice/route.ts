import { NextResponse } from "next/server";
import { parsePdfWithLlamaParse } from "@/lib/llamaparse";
import { parseInvoiceText } from "@/lib/invoice/parseInvoiceText";

/**
 * POST /api/projects/parse-invoice
 *
 * Accepts a PDF file upload (multipart form, field "file") and returns
 * heuristically-extracted fields suitable for pre-filling the New Project
 * wizard. Uses pdf-parse first, falls back to LlamaParse OCR for scanned PDFs.
 *
 * This is a UX accelerator: missing fields are simply omitted and the user
 * completes them manually. It never fails hard on extraction gaps.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = file.name || "invoice.pdf";
  const buf = Buffer.from(await file.arrayBuffer());

  // Extract text — pdf-parse first, OCR fallback
  let text = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    text = data.text || "";
  } catch {
    // Swallow — we'll try OCR next
  }

  if (!text.trim()) {
    try {
      const result = await parsePdfWithLlamaParse(buf, fileName);
      text = result.text || "";
    } catch (ocrErr) {
      // Return a friendly message — still include fileName so the UI can
      // pre-fill the description with something useful.
      const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      return NextResponse.json({
        extracted: {
          description: fileName.replace(/\.pdf$/i, ""),
        },
        warning: `PDF text extraction failed. ${msg}`,
      });
    }
  }

  const extracted = parseInvoiceText(text);
  // Fall back to file name when no description was found
  if (!extracted.description) {
    extracted.description = fileName.replace(/\.pdf$/i, "");
  }

  return NextResponse.json({ extracted });
}
