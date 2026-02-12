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
});
