import { computeSideUnitSellingTotal, SideUnitInputs } from "../sideUnit";

const base: SideUnitInputs = {
  width: 18,
  depth: 16,
  height: 72,
  kickplate: false,
  framingStyle: "Sides only",
  mountingStyle: "Freestanding",
  drawers: 0,
  doors: 0,
  thickFrame: false,
  doorStyle: "Slab/Flat",
};

describe("computeSideUnitSellingTotal", () => {
  it("base 18x16x72 = 1000", () => {
    expect(computeSideUnitSellingTotal(base)).toBe(1000);
  });

  it("width 24 adds 50*roundUp(6/6)=50", () => {
    expect(computeSideUnitSellingTotal({ ...base, width: 24 })).toBe(1050);
  });

  it("depth 19 adds 50*roundUp(3/3)=50", () => {
    expect(computeSideUnitSellingTotal({ ...base, depth: 19 })).toBe(1050);
  });

  it("height 78 adds 50*roundUp(6/6)=50", () => {
    expect(computeSideUnitSellingTotal({ ...base, height: 78 })).toBe(1050);
  });

  it("kickplate width<=18 adds 50", () => {
    expect(computeSideUnitSellingTotal({ ...base, kickplate: true })).toBe(1050);
  });

  it("Frame everything adds 300", () => {
    expect(computeSideUnitSellingTotal({ ...base, framingStyle: "Frame everything" })).toBe(1300);
  });

  it("Standard Shaker multiplies by 1.15", () => {
    expect(computeSideUnitSellingTotal({ ...base, doorStyle: "Standard Shaker" })).toBe(1150);
  });
});
