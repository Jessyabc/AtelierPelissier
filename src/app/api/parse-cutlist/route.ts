import { NextResponse } from "next/server";
import { parseCutlistTextToParts } from "@/lib/cutlist/parseCutlistPdf";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let text = "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    text = body.text ?? body.content ?? "";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const buf = await file.arrayBuffer();
        const data = await pdfParse(Buffer.from(buf));
        text = data.text || "";
      } catch (err) {
        return NextResponse.json(
          { error: "Could not read text from PDF", details: String(err) },
          { status: 400 }
        );
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
      { error: "No text or file content provided" },
      { status: 400 }
    );
  }

  const parts = parseCutlistTextToParts(text);
  return NextResponse.json({ parts });
}
