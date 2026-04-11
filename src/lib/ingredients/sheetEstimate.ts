/**
 * Sheet estimation utility — groups panels by material code and computes
 * how many full sheets are needed, including waste factor.
 */

import type { EstimatedPanel, SheetEstimate } from "./types";

export type SheetFormat = {
  lengthIn: number;
  widthIn: number;
};

const DEFAULT_SHEET: SheetFormat = { lengthIn: 97, widthIn: 49 };
const DEFAULT_WASTE_FACTOR = 1.15;

/**
 * Compute sheet estimates grouped by material code.
 * - Sums panel area per material group
 * - Divides by usable sheet area (sheetLength × sheetWidth)
 * - Applies waste factor multiplier
 * - Ceils to whole sheets
 */
export function computeSheetEstimates(
  panels: EstimatedPanel[],
  sheetFormat: SheetFormat = DEFAULT_SHEET,
  wasteFactor: number = DEFAULT_WASTE_FACTOR
): SheetEstimate[] {
  const groups = new Map<string, { totalArea: number; panelCount: number }>();

  for (const panel of panels) {
    const code = panel.materialCode;
    const area = panel.lengthIn * panel.widthIn * panel.qty;
    const existing = groups.get(code);
    if (existing) {
      existing.totalArea += area;
      existing.panelCount += panel.qty;
    } else {
      groups.set(code, { totalArea: area, panelCount: panel.qty });
    }
  }

  const sheetArea = sheetFormat.lengthIn * sheetFormat.widthIn;
  const estimates: SheetEstimate[] = [];

  for (const [materialCode, { totalArea, panelCount }] of groups) {
    const rawSheets = totalArea / sheetArea;
    const sheetsNeeded = Math.ceil(rawSheets * wasteFactor);

    estimates.push({
      materialCode,
      totalAreaSqIn: totalArea,
      sheetAreaSqIn: sheetArea,
      rawSheets: Math.round(rawSheets * 100) / 100,
      sheetsNeeded,
      panelCount,
    });
  }

  return estimates;
}
