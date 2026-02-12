/**
 * Kitchen cost-plus pricing. Pure function; all amounts in dollars.
 * Returns { total, breakdown }.
 */

export type KitchenPricingInputs = {
  costSubtotal: number;
  markup: number;
  taxEnabled: boolean;
  taxRate: number;
};

export type KitchenPricingBreakdown = {
  costSubtotal: number;
  sellingPriceBeforeTax: number;
  taxAmount: number;
  total: number;
};

export function computeKitchenSelling(input: KitchenPricingInputs): {
  total: number;
  breakdown: KitchenPricingBreakdown;
} {
  const { costSubtotal, markup, taxEnabled, taxRate } = input;
  const sellingPriceBeforeTax = Math.round(costSubtotal * markup * 100) / 100;
  const taxAmount = taxEnabled ? Math.round(sellingPriceBeforeTax * taxRate * 100) / 100 : 0;
  const total = Math.round((sellingPriceBeforeTax + taxAmount) * 100) / 100;

  return {
    total,
    breakdown: {
      costSubtotal,
      sellingPriceBeforeTax,
      taxAmount,
      total,
    },
  };
}
