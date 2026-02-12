import { computeCountertopTotal, CountertopInputs } from "../countertop";

describe("computeCountertopTotal", () => {
  it("countertop false returns -90 (sinks Single = 90, then -90)", () => {
    expect(
      computeCountertopTotal({
        sinks: "Single",
        faucetHoles: "No Hole",
        countertop: false,
        countertopWidth: 0,
        countertopDepth: 0,
        priceRangePi2: 0,
      })
    ).toBe(0);
  });

  it("countertop false with no sink: 0 + 0 - 90 = -90", () => {
    expect(
      computeCountertopTotal({
        sinks: "None",
        faucetHoles: "No Hole",
        countertop: false,
        countertopWidth: 0,
        countertopDepth: 0,
        priceRangePi2: 0,
      })
    ).toBe(-90);
  });

  it("countertop true with area and price: ROUND((W*D)/144*price, 2)", () => {
    // 48*24/144 = 8 sq ft, 8 * 50 = 400
    expect(
      computeCountertopTotal({
        sinks: "None",
        faucetHoles: "No Hole",
        countertop: true,
        countertopWidth: 48,
        countertopDepth: 24,
        priceRangePi2: 50,
      })
    ).toBe(400);
  });

  it("rounds to 2 decimals", () => {
    expect(
      computeCountertopTotal({
        sinks: "None",
        faucetHoles: "No Hole",
        countertop: true,
        countertopWidth: 36,
        countertopDepth: 22,
        priceRangePi2: 33.33,
      })
    ).toBeCloseTo(183.32, 2);
    expect(
      computeCountertopTotal({
        sinks: "None",
        faucetHoles: "No Hole",
        countertop: true,
        countertopWidth: 36,
        countertopDepth: 22,
        priceRangePi2: 33.33,
      })
    ).toBe(183.32);
  });

  it("Single Vessel = 45, Double Vessel = 90", () => {
    expect(
      computeCountertopTotal({
        sinks: "Single Vessel",
        faucetHoles: "No Hole",
        countertop: false,
        countertopWidth: 0,
        countertopDepth: 0,
        priceRangePi2: 0,
      })
    ).toBe(45 - 90);
    expect(
      computeCountertopTotal({
        sinks: "Double Vessel",
        faucetHoles: "No Hole",
        countertop: false,
        countertopWidth: 0,
        countertopDepth: 0,
        priceRangePi2: 0,
      })
    ).toBe(90 - 90);
  });
});
