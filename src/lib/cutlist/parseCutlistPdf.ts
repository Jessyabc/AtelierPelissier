/**
 * Parse CutList PDF text: extract "Panneau / Qté" table into PanelPart[].
 * Dimensions like 3' 3 1/4" and 0' 8" are converted to inches.
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
 * Extract table rows from text that looks like:
 * Panneau / Qté
 * Label    Length    Width    Qty
 * Part A   3' 3 1/4"  0' 8"    2
 * ...
 * We look for a section containing "Panneau" or "Qté" and then parse rows with dimension-like columns.
 */
export function parseCutlistTextToParts(text: string): PanelPartNormalized[] {
  const parts: PanelPartNormalized[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Dimension pattern: feet' inches" or feet' inches frac"
  const dimRe = /\d+'\s*\d+(?:\s+\d+\/\d+)?\s*"/g;
  const dimReSingle = /(\d+')\s*(\d+(?:\s+\d+\/\d+)?\s*")/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dims = line.match(dimRe);
    if (!dims || dims.length < 2) continue;

    const lengthIn = parseDimensionToInches(dims[0]);
    const widthIn = parseDimensionToInches(dims[1]);
    if (lengthIn <= 0 && widthIn <= 0) continue;

    // Qty: often last number on line or after dimensions
    const numbers = line.match(/\d+/g);
    let qty = 1;
    if (numbers && numbers.length >= 3) {
      const last = numbers[numbers.length - 1];
      const lastNum = parseInt(last, 10);
      if (lastNum >= 1 && lastNum <= 999) qty = lastNum;
    }

    // Label: text before first dimension
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
