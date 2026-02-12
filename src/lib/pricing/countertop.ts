/**
 * Countertop formula (Monday.com exact replica).
 * Pure function; returns { total, breakdown }. Total has 2 decimals; includes -90 when countertop is false.
 */

export type CountertopInputs = {
  sinks: "Single" | "Double" | "Single Vessel" | "Double Vessel" | "None";
  faucetHoles: '4" center' | '8" center' | "One hole" | "No Hole";
  countertop: boolean;
  countertopWidth: number;
  countertopDepth: number;
  priceRangePi2: number;
};

export type CountertopBreakdown = {
  sinksComponent: number;
  faucetComponent: number;
  surfaceComponent: number;
  total: number;
};

export function computeCountertop(input: CountertopInputs): { total: number; breakdown: CountertopBreakdown } {
  const { sinks, faucetHoles, countertop, countertopWidth, countertopDepth, priceRangePi2 } = input;

  const sinksComponent =
    sinks === "Single"
      ? 90
      : sinks === "Double"
        ? 180
        : sinks === "Single Vessel"
          ? 45
          : sinks === "Double Vessel"
            ? 90
            : 0;

  const faucetComponent =
    faucetHoles === '4" center' || faucetHoles === '8" center'
      ? sinks === "Double" || sinks === "Double Vessel"
        ? 25 * 2
        : 25
      : 0;

  const surfaceComponent = countertop
    ? Math.round((countertopWidth * countertopDepth) / 144 * priceRangePi2 * 100) / 100
    : -90;

  const total = Math.round((sinksComponent + faucetComponent + surfaceComponent) * 100) / 100;

  return {
    total,
    breakdown: {
      sinksComponent,
      faucetComponent,
      surfaceComponent,
      total,
    },
  };
}

/** @deprecated Use computeCountertop(input).total */
export function computeCountertopTotal(input: CountertopInputs): number {
  return computeCountertop(input).total;
}
