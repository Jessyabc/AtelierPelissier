import { computeVanitySellingTotal, VanityInputs } from "../vanity";

const base: VanityInputs = {
  width: 24,
  depth: 22,
  kickplate: false,
  framingStyle: "Sides only",
  mountingStyle: "Freestanding",
  drawers: 0,
  doors: 0,
  thickFrame: false,
  numberOfSinks: "Single",
  doorStyle: "Slab/Flat",
};

describe("computeVanitySellingTotal", () => {
  it("base 24x22 single sink slab = 800 + 100 = 900", () => {
    expect(computeVanitySellingTotal(base)).toBe(900);
  });

  it("width 30 adds 50*roundUp(6/6)=50", () => {
    expect(computeVanitySellingTotal({ ...base, width: 30 })).toBe(950);
  });

  it("depth 25 adds 50*roundUp(3/3)=50", () => {
    expect(computeVanitySellingTotal({ ...base, depth: 25 })).toBe(950);
  });

  it("kickplate and width<=72 adds 50", () => {
    expect(computeVanitySellingTotal({ ...base, kickplate: true })).toBe(950);
  });

  it("FramingStyle Sides and bottom adds 100", () => {
    expect(computeVanitySellingTotal({ ...base, framingStyle: "Sides and bottom" })).toBe(1000);
  });

  it("2 drawers and 1 door: + 175*2 + 100 = 450, total 1350", () => {
    expect(computeVanitySellingTotal({ ...base, drawers: 2, doors: 1 })).toBe(1350);
  });

  it("Thin Shaker multiplies by 1.2", () => {
    const withDoors = { ...base, doors: 1 };
    expect(computeVanitySellingTotal(withDoors)).toBe(1000);
    expect(computeVanitySellingTotal({ ...withDoors, doorStyle: "Thin Shaker" })).toBe(1200);
  });

  it("Double sink adds 150 instead of 100", () => {
    expect(computeVanitySellingTotal({ ...base, numberOfSinks: "Double" })).toBe(950);
  });
});
