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
  // Labeled prefix: "invoice", "facture", "job", "no.", "numéro", "number"
  /\b(?:invoice|facture|job|no\.?|num[ée]ro|number)\s*[#:]?\s*([A-Z]{1,4}[- ]?\d{3,8})\b/i,
  // Bare code format: MC-6629, AB-1234
  /\b([A-Z]{2,4}-\d{3,8})\b/,
  // Numeric-only invoice number with explicit label
  /\b(?:invoice|facture)\s*(?:#|number|no\.?)\s*[:\-]?\s*(\d{3,10})\b/i,
];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// Canadian/US phone: (514) 555-1234, 514-555-1234, (514-555-1234), +1 514 555 1234
const PHONE_RE = /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/;

// Detects the item table header row (Item | Qty/Hrs | Price/Rate …)
const TABLE_HEADER_RE = /\b(?:item|article)\b.{0,40}\b(?:qty|qté|quantity|quantit[eé]|hrs?)\b/i;

// Lines to skip when scanning for item names after the table header (French cabinet invoices)
const ITEM_SKIP_RE =
  /^(?:item\b|qty\b|hrs?\b|price\b|discount\b|net\b|dimensions?|nombre|style\s+(?:de|d')|encadrement|épaisseur|coup\s+de\s+pied|disposition\b|couleur|poignées?|backsplash|lavabo\s+inclus|caissons?\s+du|noter\s+que|inclusion\s+de|\*+|comments?|terms?\s+(?:and|&)|aucun)/i;

// Lines to skip in generic fallback description extraction
const GENERIC_SKIP_RE =
  /^(?:invoice|facture|date|total|subtotal|tax|tps|tvq|gst|qst|bill\s+to|ship\s+to|sold\s+to)\b/i;

// Lines that should not be treated as a client name (metadata labels, URLs, tax lines)
const NAME_SKIP_RE =
  /^(?:number\b|reference\b|ref[eé]rence\b|issued\b|due\b|deliver\b|bill\s+to|ship\s+to|sold\s+to|www\.|http|gst|qst|tps|tvq|item\b|total\b|subtotal\b)/i;

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

  // --- phone (global fallback; may be overridden below by client-specific phone) ---
  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch) result.client!.phone = phoneMatch[0].trim();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- client name ---
  // Attempt 1: explicit label ("Bill To:", "Client:", "Facturé à:", …)
  const LABEL_RE = /^(?:bill\s*to|client|customer|sold\s*to|ship\s*to|facturé\s*à|client\s*:)\b/i;
  let clientFound = false;
  for (let i = 0; i < lines.length; i++) {
    if (LABEL_RE.test(lines[i])) {
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
        const addrCandidate = inline ? lines[i + 1] : lines[i + 2];
        if (
          addrCandidate &&
          /\d{1,5}\s+\w+/.test(addrCandidate) &&
          !EMAIL_RE.test(addrCandidate) &&
          !PHONE_RE.test(addrCandidate)
        ) {
          result.client!.address = addrCandidate;
        }
        clientFound = true;
        break;
      }
    }
  }

  // Attempt 2: unlabeled client block — a line immediately followed by a phone number.
  // Common in invoices (e.g. MoncCost/EvosBoutiques format) where the client name
  // sits in a box without any "Bill To" label, with the phone on the very next line.
  if (!clientFound) {
    for (let i = 0; i < lines.length - 1; i++) {
      const candidate = lines[i];
      const nextLine = lines[i + 1];
      if (
        PHONE_RE.test(nextLine) &&
        !PHONE_RE.test(candidate) &&
        !EMAIL_RE.test(candidate) &&
        !NAME_SKIP_RE.test(candidate) &&
        !/^\d/.test(candidate) &&
        candidate.length >= 4 &&
        candidate.length < 70 &&
        /[A-Za-z]/.test(candidate)
      ) {
        const parts = candidate.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          result.client!.firstName = parts[0];
          result.client!.lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          result.client!.lastName = parts[0];
        }
        // Use this line's phone rather than the first phone in the entire document,
        // which might be the company's phone number.
        const clientPhone = nextLine.match(PHONE_RE);
        if (clientPhone) result.client!.phone = clientPhone[0].trim();
        // Look for street address in the lines that follow the phone
        for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
          if (
            /^\d{1,5}\s+\S/.test(lines[j]) &&
            !PHONE_RE.test(lines[j]) &&
            !EMAIL_RE.test(lines[j])
          ) {
            result.client!.address = lines[j];
            break;
          }
        }
        break;
      }
    }
  }

  // --- description / item names ---
  // Prefer item names extracted from the invoice item table when a table header is found.
  const tableHeaderIdx = lines.findIndex((l) => TABLE_HEADER_RE.test(l));
  if (tableHeaderIdx >= 0) {
    const itemNames: string[] = [];
    for (let i = tableHeaderIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (
        l.length > 4 &&
        l.length < 100 &&
        !ITEM_SKIP_RE.test(l) &&
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !/^\d/.test(l) &&
        !/\b(?:gst|qst|tps|tvq)\b/i.test(l) &&
        !/\b(?:total|net|subtotal)\b/i.test(l)
      ) {
        if (!itemNames.includes(l)) itemNames.push(l);
        if (itemNames.length >= 3) break;
      }
    }
    if (itemNames.length > 0) {
      result.description = itemNames.join(" / ");
    }
  }

  // Fallback: first plausible line for invoices without a structured item table
  if (!result.description) {
    const descCandidate = lines.find(
      (l) =>
        l.length > 6 &&
        l.length < 80 &&
        !GENERIC_SKIP_RE.test(l) &&
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !/^\d/.test(l)
    );
    if (descCandidate && descCandidate !== result.invoiceNumber) {
      result.description = descCandidate;
    }
  }

  // Clean up empty client object
  if (!Object.values(result.client!).some(Boolean)) {
    delete result.client;
  }

  return result;
}
