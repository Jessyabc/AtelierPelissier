/**
 * Material requirement calculation: derive required sheet quantity from PanelParts.
 * Uses SheetFormat for sheet dimensions and wasteFactor from risk settings.
 */

export type SheetFormatInput = {
  lengthIn: number;
  widthIn: number;
};

export type PanelPartInput = {
  materialCode: string | null;
  lengthIn: number;
  widthIn: number;
  qty: number;
};

/**
 * Group panel parts by materialCode and compute required sheet quantity.
 * requiredQty = ceil((totalArea / sheetArea) × wasteFactor)
 * Parts with null/empty materialCode are skipped.
 */
export function computeRequiredQtyByMaterial(
  panelParts: PanelPartInput[],
  sheetFormat: SheetFormatInput | null,
  wasteFactor: number
): Record<string, number> {
  const result: Record<string, number> = {};

  const sheetArea = sheetFormat && sheetFormat.lengthIn > 0 && sheetFormat.widthIn > 0
    ? sheetFormat.lengthIn * sheetFormat.widthIn
    : 0;

  for (const part of panelParts) {
    const code = part.materialCode?.trim();
    if (!code) continue;

    const partArea = part.lengthIn * part.widthIn * part.qty;
    if (partArea <= 0) continue;

    const prev = result[code] ?? 0;
    result[code] = prev + partArea;
  }

  for (const code of Object.keys(result)) {
    const totalArea = result[code];
    if (sheetArea <= 0) {
      result[code] = Math.ceil(totalArea); // fallback: treat as raw units if no sheet format
    } else {
      result[code] = Math.ceil((totalArea / sheetArea) * wasteFactor);
    }
  }

  return result;
}
