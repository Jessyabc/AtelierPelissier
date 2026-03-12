import { NextResponse } from "next/server";
import { parseCutlistTextToParts } from "@/lib/cutlist/parseCutlistPdf";
import { parsePdfWithLlamaParse } from "@/lib/llamaparse";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let text = "";
  let pdfBuffer: Buffer | null = null;
  let pdfFileName = "cutlist.pdf";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    text = body.text ?? body.content ?? "";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const buf = await file.arrayBuffer();
      pdfBuffer = Buffer.from(buf);
      pdfFileName = file.name || pdfFileName;
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(pdfBuffer);
        text = data.text || "";
      } catch (err) {
        return NextResponse.json(
          { error: "Could not read text from PDF", details: String(err) },
          { status: 400 }
        );
      }
      // If no text was extracted (scanned/image PDF), try LlamaParse OCR
      if (!text.trim() && pdfBuffer.length > 0) {
        try {
          const result = await parsePdfWithLlamaParse(pdfBuffer, pdfFileName);
          text = result.text || "";
        } catch (ocrErr) {
          const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
          return NextResponse.json(
            {
              error: "PDF has no selectable text (likely scanned). OCR failed.",
              details: msg,
            },
            { status: 400 }
          );
        }
      }
    } else {
      const paste = formData.get("text") as string | null;
      text = paste ?? "";
    }
  } else {
    const body = await request.text();
    text = body;
  }

  if (!text || !text.trim()) {
    return NextResponse.json(
      {
        error: pdfBuffer
          ? "No text could be extracted from the PDF. If it’s a scanned document, set LLAMAPARSE_API_KEY for OCR."
          : "No text or file content provided",
      },
      { status: 400 }
    );
  }

  const parts = parseCutlistTextToParts(text);
  return NextResponse.json({ parts });
}
