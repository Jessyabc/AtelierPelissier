/**
 * LlamaParse (LlamaCloud) API client for OCR of PDFs that have no embedded text.
 * Used as fallback when pdf-parse returns empty text (e.g. scanned cutlists).
 *
 * Requires LLAMAPARSE_API_KEY in env (same key as Llama Cloud / LlamaParse dashboard).
 */

const LLAMAPARSE_BASE = "https://api.cloud.llamaindex.ai";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_WAIT_MS = 120000; // 2 min

export type LlamaParseResult = { text: string };

/**
 * Upload a PDF buffer to LlamaParse, poll until the job completes, and return
 * the extracted full text. Throws if the key is missing, upload fails, or job fails.
 */
export async function parsePdfWithLlamaParse(
  pdfBuffer: Buffer,
  fileName: string = "cutlist.pdf"
): Promise<LlamaParseResult> {
  const apiKey = process.env.LLAMAPARSE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LLAMAPARSE_API_KEY is not set. Add it to .env.local to use OCR for scanned PDFs."
    );
  }

  // 1. Upload file (multipart)
  const form = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  form.set("file", blob, fileName);
  form.set(
    "configuration",
    JSON.stringify({ tier: "fast", version: "latest" })
  );

  const uploadRes = await fetch(`${LLAMAPARSE_BASE}/api/v2/parse/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    throw new Error(
      `LlamaParse upload failed (${uploadRes.status}): ${errBody || uploadRes.statusText}`
    );
  }

  const uploadJson = (await uploadRes.json()) as {
    id?: string;
    job_id?: string;
    job?: { id?: string };
  };
  const jobId = uploadJson.id ?? uploadJson.job_id ?? uploadJson.job?.id;
  if (!jobId) {
    throw new Error("LlamaParse upload response missing job id");
  }

  // 2. Poll until COMPLETED or FAILED
  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const jobRes = await fetch(
      `${LLAMAPARSE_BASE}/api/v2/parse/${jobId}?expand=text_full`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!jobRes.ok) {
      throw new Error(
        `LlamaParse job status failed (${jobRes.status}): ${await jobRes.text()}`
      );
    }
    const jobJson = (await jobRes.json()) as {
      status?: string;
      text_full?: string;
      error_message?: string;
    };
    const status = (jobJson.status ?? "").toUpperCase();

    if (status === "COMPLETED") {
      const text = typeof jobJson.text_full === "string" ? jobJson.text_full : "";
      return { text };
    }
    if (status === "FAILED" || status === "CANCELLED") {
      throw new Error(
        jobJson.error_message || `LlamaParse job ${status}`
      );
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("LlamaParse job timed out waiting for result");
}
