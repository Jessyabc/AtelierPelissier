import { computeSheetEstimates } from "../sheetEstimate";
import type { EstimatedPanel } from "../types";

function panel(overrides: Partial<EstimatedPanel> = {}): EstimatedPanel {
  return {
    label: "Test panel",
    lengthIn: 30,
    widthIn: 22,
    qty: 1,
    materialCode: "MEL-WHT-5/8-4x8",
    thicknessIn: 0.625,
    category: "carcass",
    edgeBandedEdges: 0,
    ...overrides,
  };
}

describe("computeSheetEstimates", () => {
  it("groups panels by material code", () => {
    const panels: EstimatedPanel[] = [
      panel({ materialCode: "MAT-A", qty: 2 }),
      panel({ materialCode: "MAT-B", qty: 1 }),
      panel({ materialCode: "MAT-A", qty: 3 }),
    ];

    const result = computeSheetEstimates(panels, { lengthIn: 97, widthIn: 49 }, 1.0);

    expect(result).toHaveLength(2);
    const matA = result.find((s) => s.materialCode === "MAT-A");
    expect(matA).toBeDefined();
    expect(matA!.panelCount).toBe(5); // 2 + 3
  });

  it("applies waste factor correctly", () => {
    // Single panel: 97 x 49 = 4753 sq in (exactly one sheet)
    const panels: EstimatedPanel[] = [
      panel({ lengthIn: 97, widthIn: 49, qty: 1 }),
    ];

    // With 1.0 waste factor → 1 sheet
    const noWaste = computeSheetEstimates(panels, { lengthIn: 97, widthIn: 49 }, 1.0);
    expect(noWaste[0].sheetsNeeded).toBe(1);

    // With 1.15 waste factor → ceil(1 * 1.15) = 2 sheets
    const withWaste = computeSheetEstimates(panels, { lengthIn: 97, widthIn: 49 }, 1.15);
    expect(withWaste[0].sheetsNeeded).toBe(2);
  });

  it("ceils to whole sheets", () => {
    // Panel area slightly more than 1 sheet
    const panels: EstimatedPanel[] = [
      panel({ lengthIn: 98, widthIn: 49, qty: 1 }),
    ];

    const result = computeSheetEstimates(panels, { lengthIn: 97, widthIn: 49 }, 1.0);
    expect(result[0].sheetsNeeded).toBe(2); // ceil(98*49 / 97*49) = ceil(1.01) = 2
  });

  it("handles multiple quantities", () => {
    const panels: EstimatedPanel[] = [
      panel({ lengthIn: 30, widthIn: 22, qty: 10 }),
    ];

    const result = computeSheetEstimates(panels, { lengthIn: 97, widthIn: 49 }, 1.15);
    // Total area = 30 * 22 * 10 = 6600 sq in
    // Sheet area = 97 * 49 = 4753 sq in
    // Raw sheets = 6600 / 4753 ≈ 1.389
    // With waste: ceil(1.389 * 1.15) = ceil(1.597) = 2
    expect(result[0].sheetsNeeded).toBe(2);
  });

  it("returns empty array for no panels", () => {
    const result = computeSheetEstimates([], { lengthIn: 97, widthIn: 49 }, 1.15);
    expect(result).toHaveLength(0);
  });
});
