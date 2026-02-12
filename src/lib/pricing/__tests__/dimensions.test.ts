import { parseDimensionToInches } from "../dimensions";

describe("parseDimensionToInches", () => {
  it("parses 3' 3 1/4\" to 39.25", () => {
    expect(parseDimensionToInches("3' 3 1/4\"")).toBeCloseTo(36 + 3.25, 10);
    expect(parseDimensionToInches("3' 3 1/4\"")).toBe(39.25);
  });

  it("parses 0' 8\" to 8", () => {
    expect(parseDimensionToInches("0' 8\"")).toBe(8);
  });

  it("parses 4' 0\" to 48", () => {
    expect(parseDimensionToInches("4' 0\"")).toBe(48);
  });

  it("parses feet only 9' to 108", () => {
    expect(parseDimensionToInches("9'")).toBe(108);
  });

  it("parses inches only 8 to 8", () => {
    expect(parseDimensionToInches("8")).toBe(8);
  });

  it("parses 1/2 inch in fractional form", () => {
    expect(parseDimensionToInches("0' 0 1/2\"")).toBe(0.5);
  });

  it("parses 8 1/2 as standalone inches", () => {
    expect(parseDimensionToInches("8 1/2")).toBeCloseTo(8.5, 10);
  });

  it("returns 0 for empty string", () => {
    expect(parseDimensionToInches("")).toBe(0);
  });
});
