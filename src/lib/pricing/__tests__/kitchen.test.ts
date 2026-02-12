import { computeKitchenSelling } from "../kitchen";

describe("computeKitchenSelling", () => {
  it("returns total and breakdown", () => {
    const result = computeKitchenSelling({
      costSubtotal: 1000,
      markup: 2.5,
      taxEnabled: false,
      taxRate: 0.14975,
    });
    expect(result.total).toBe(2500);
    expect(result.breakdown.costSubtotal).toBe(1000);
    expect(result.breakdown.sellingPriceBeforeTax).toBe(2500);
    expect(result.breakdown.taxAmount).toBe(0);
  });

  it("adds tax when taxEnabled true", () => {
    const result = computeKitchenSelling({
      costSubtotal: 1000,
      markup: 2.5,
      taxEnabled: true,
      taxRate: 0.1,
    });
    expect(result.breakdown.sellingPriceBeforeTax).toBe(2500);
    expect(result.breakdown.taxAmount).toBe(250);
    expect(result.total).toBe(2750);
  });
});
