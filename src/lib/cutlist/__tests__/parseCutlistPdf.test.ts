import { parseCutlistTextToParts } from "../parseCutlistPdf";

describe("parseCutlistTextToParts", () => {
  it("extracts parts from fixture text with Panneau / Qté table", () => {
    const fixture = `
Panneau / Qté
Nom          Longueur   Largeur   Qté
Side panel   3' 3 1/4"  0' 8"     2
Shelf        2' 0"      0' 10"    4
`;
    const parts = parseCutlistTextToParts(fixture);
    expect(parts.length).toBe(2);
    expect(parts[0].label).toContain("Side");
    expect(parts[0].lengthIn).toBeCloseTo(39.25, 2);
    expect(parts[0].widthIn).toBe(8);
    expect(parts[0].qty).toBe(2);
    expect(parts[1].lengthIn).toBe(24);
    expect(parts[1].widthIn).toBe(10);
    expect(parts[1].qty).toBe(4);
  });

  it("returns empty array when no dimension pairs found", () => {
    expect(parseCutlistTextToParts("No dimensions here")).toEqual([]);
    expect(parseCutlistTextToParts("")).toEqual([]);
  });

  it("extracts parts from optimizer-style Result column (L×W decimal inches)", () => {
    const optimizerText = `
#	Panel	Cut	Result
1	49×97	x=96	- \\ surplus 49×0.87
2	49×96	y=24	24×96 \\ -
3	24.87×96	y=24	24×96 \\ surplus 0.74×96
2	34.5×97	x=24	34.5×24 \\ -
`;
    const parts = parseCutlistTextToParts(optimizerText);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const part96x24 = parts.find((p) => p.lengthIn === 96 && p.widthIn === 24);
    expect(part96x24).toBeDefined();
    expect(part96x24!.qty).toBe(2); // two rows produce 24×96
    const part34_5x24 = parts.find((p) => p.lengthIn === 34.5 && p.widthIn === 24);
    expect(part34_5x24).toBeDefined();
    expect(part34_5x24!.qty).toBe(1);
  });

  it("parses OCR-style lines with letter x and surplus keyword", () => {
    const ocrStyle = `
2	49x96	y=24	24x96 \\ -
3	24.87x96	y=24	24x96 \\ surplus 0.74x96
2	34.5x97	x=24	34.5x24 \\ -
`;
    const parts = parseCutlistTextToParts(ocrStyle);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const part96x24 = parts.find((p) => p.lengthIn === 96 && p.widthIn === 24);
    expect(part96x24?.qty).toBe(2);
  });
});
