/**
 * Parse CutList PDF text: extract panel parts into PanelPart[].
 * Supports:
 * 1) Optimizer-style: tab-separated, Result column with "L×W \ ..." (decimal inches)
 * 2) Panneau / Qté style: dimensions like 3' 3 1/4" and 0' 8" (feet + inches)
 */

import { parseDimensionToInches } from "@/lib/pricing/dimensions";

export type PanelPartNormalized = {
  label: string;
  lengthIn: number;
  widthIn: number;
  qty: number;
  materialCode?: string;
  thicknessIn?: number;
};

/**
 * Find the result dimension on a line: the "L×W" that immediately precedes " \ " or " surplus"
 * so we don't pick up the Panel column (e.g. 49×97). Handles OCR (spaces instead of tabs, letter x).
 */
function extractResultDimension(line: string): { a: number; b: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Dimension followed by optional space and then backslash or "surplus" = result part
  const resultDimRe = /(\d+(?:\.\d+)?)[×x](\d+(?:\.\d+)?)\s*(?:\\|\/|\bsurplus)/i;
  const match = trimmed.match(resultDimRe);
  if (match) {
    const a = parseFloat(match[1]);
    const b = parseFloat(match[2]);
    if (a > 0 && b > 0) return { a, b };
  }
  // Fallback: tab-separated, last column is Result; part before " \ " must not be "-"
  const byTab = trimmed.split(/\t/);
  if (byTab.length >= 4) {
    const resultCol = byTab[byTab.length - 1]!.trim();
    const main = resultCol.split(/\s*\\\s*/)[0]?.trim();
    if (main && main !== "-") {
      const dimMatch = main.match(/(\d+(?:\.\d+)?)[×x](\d+(?:\.\d+)?)/i);
      if (dimMatch) {
        const a = parseFloat(dimMatch[1]);
        const b = parseFloat(dimMatch[2]);
        if (a > 0 && b > 0) return { a, b };
      }
    }
  }
  return null;
}

/**
 * Parse optimizer output: # Panel Cut Result with Result like "24×96 \ -" or "12×40.75 \ surplus ...".
 * Tolerates OCR: letter x instead of ×, spaces instead of tabs. Aggregates by size (length = longer side).
 */
function parseOptimizerFormat(text: string): PanelPartNormalized[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const byKey = new Map<string, { lengthIn: number; widthIn: number; qty: number }>();

  for (const line of lines) {
    const dim = extractResultDimension(line);
    if (!dim) continue;

    const lengthIn = Math.round(Math.max(dim.a, dim.b) * 1000) / 1000;
    const widthIn = Math.round(Math.min(dim.a, dim.b) * 1000) / 1000;
    const key = `${lengthIn},${widthIn}`;
    const existing = byKey.get(key);
    if (existing) existing.qty += 1;
    else byKey.set(key, { lengthIn, widthIn, qty: 1 });
  }

  return Array.from(byKey.entries()).map(([_, p]) => ({
    label: `${p.lengthIn} × ${p.widthIn}`,
    lengthIn: p.lengthIn,
    widthIn: p.widthIn,
    qty: p.qty,
  }));
}

/**
 * Extract table rows from text that looks like:
 * Panneau / Qté
 * Label    Length    Width    Qty
 * Part A   3' 3 1/4"  0' 8"    2
 */
function parseFeetInchesFormat(text: string): PanelPartNormalized[] {
  const parts: PanelPartNormalized[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dimRe = /\d+'\s*\d+(?:\s+\d+\/\d+)?\s*"/g;
  const dimReSingle = /(\d+')\s*(\d+(?:\s+\d+\/\d+)?\s*")/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dims = line.match(dimRe);
    if (!dims || dims.length < 2) continue;

    const lengthIn = parseDimensionToInches(dims[0]);
    const widthIn = parseDimensionToInches(dims[1]);
    if (lengthIn <= 0 && widthIn <= 0) continue;

    const numbers = line.match(/\d+/g);
    let qty = 1;
    if (numbers && numbers.length >= 3) {
      const lastNum = parseInt(numbers[numbers.length - 1], 10);
      if (lastNum >= 1 && lastNum <= 999) qty = lastNum;
    }

    const firstDimIndex = line.search(dimReSingle);
    const label = (firstDimIndex > 0 ? line.slice(0, firstDimIndex) : line).trim() || `Part ${parts.length + 1}`;

    parts.push({
      label: label || `Part ${parts.length + 1}`,
      lengthIn: Math.round(lengthIn * 1000) / 1000,
      widthIn: Math.round(widthIn * 1000) / 1000,
      qty,
    });
  }

  return parts;
}

/**
 * Try optimizer format first (L×W in Result column); if no parts, try feet'inches" format.
 */
export function parseCutlistTextToParts(text: string): PanelPartNormalized[] {
  const optimizerParts = parseOptimizerFormat(text);
  if (optimizerParts.length > 0) return optimizerParts;
  return parseFeetInchesFormat(text);
}
