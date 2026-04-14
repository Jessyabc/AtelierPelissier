/**
 * Invoice text heuristic extractor.
 *
 * Takes raw text (from pdf-parse or OCR) and attempts to pull out the fields
 * that pre-fill the New Project wizard: invoice/job number, description, and
 * a client record (first/last name, email, phone, address).
 *
 * Intentionally simple — this is a UX accelerator, not a production invoice
 * parser. Anything the heuristics can't find is just left blank and the user
 * completes it manually.
 */

export type ExtractedInvoice = {
  invoiceNumber?: string;
  description?: string;
  client?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
};

const INVOICE_NUMBER_PATTERNS = [
  /\b(?:invoice|facture|job|no\.?|num[ée]ro)\s*[#:]?\s*([A-Z]{1,4}[- ]?\d{3,8})\b/i,
  /\b([A-Z]{2,4}-\d{3,8})\b/,
  /\b(?:invoice|facture)\s*(?:#|number|no\.?)\s*[:\-]?\s*(\d{3,10})\b/i,
];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// Canadian/US phone: (514) 555-1234, 514-555-1234, 514.555.1234, +1 514 555 1234
const PHONE_RE = /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/;

/**
 * Extracts structured fields from raw invoice text using regex heuristics.
 * All fields are optional — returns whatever the heuristics can find.
 */
export function parseInvoiceText(text: string): ExtractedInvoice {
  const result: ExtractedInvoice = { client: {} };
  if (!text || !text.trim()) return result;

  // --- invoice number ---
  for (const pat of INVOICE_NUMBER_PATTERNS) {
    const m = text.match(pat);
    if (m?.[1]) {
      result.invoiceNumber = m[1].toUpperCase().replace(/\s+/g, "-");
      break;
    }
  }

  // --- email ---
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) result.client!.email = emailMatch[0];

  // --- phone ---
  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch) result.client!.phone = phoneMatch[0].trim();

  // --- client name (heuristic: look for "Bill To", "Client", "Customer" label + next non-empty line) ---
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const labelPatterns = [
    /^(?:bill\s*to|client|customer|sold\s*to|ship\s*to|facturé\s*à|client\s*:)\b/i,
  ];
  for (let i = 0; i < lines.length; i++) {
    if (labelPatterns.some((pat) => pat.test(lines[i]))) {
      // Sometimes the name is on the same line after a colon
      const inline = lines[i].split(/[:]/).slice(1).join(":").trim();
      const name = inline || lines[i + 1] || "";
      if (name && !EMAIL_RE.test(name) && !PHONE_RE.test(name)) {
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          result.client!.firstName = parts[0];
          result.client!.lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          result.client!.lastName = parts[0];
        }
        // Next line, if it looks like a street, is the address
        const next = lines[i + 2] || "";
        if (/\d{1,5}\s+\w+/.test(next) && !EMAIL_RE.test(next) && !PHONE_RE.test(next)) {
          result.client!.address = next;
        }
        break;
      }
    }
  }

  // --- description: first line that's neither a label, email, phone, nor looks like a header ---
  const headerRe = /^(?:invoice|facture|date|total|subtotal|tax|tps|tvq|gst|qst)\b/i;
  const descCandidate = lines.find(
    (l) =>
      l.length > 6 &&
      l.length < 80 &&
      !headerRe.test(l) &&
      !EMAIL_RE.test(l) &&
      !PHONE_RE.test(l) &&
      !/^\d/.test(l)
  );
  if (descCandidate && descCandidate !== result.invoiceNumber) {
    result.description = descCandidate;
  }

  // Clean up empty client object
  if (!Object.values(result.client!).some(Boolean)) {
    delete result.client;
  }

  return result;
}
