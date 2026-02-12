/**
 * Vanity selling price formula (Monday.com exact replica).
 * All dimensions in inches. Pure function; returns { total, breakdown }.
 */

export type VanityInputs = {
  width: number;
  depth: number;
  kickplate: boolean;
  framingStyle: "Sides only" | "Sides and bottom" | "Around" | "Frame everything";
  mountingStyle: "Freestanding" | "Wall-hung" | "Custom legs" | "Box base";
  drawers: number;
  doors: number;
  thickFrame: boolean;
  numberOfSinks: "Single" | "Double";
  doorStyle: "Slab/Flat" | "Thin Shaker" | "Standard Shaker";
};

export type VanityBreakdown = {
  widthComponent: number;
  depthComponent: number;
  kickplateComponent: number;
  framingComponent: number;
  mountingComponent: number;
  drawersComponent: number;
  doorsComponent: number;
  thickFrameComponent: number;
  sinksComponent: number;
  baseSubtotal: number;
  doorMultiplier: number;
  total: number;
};

function roundUp(value: number): number {
  return Math.ceil(value);
}

export function computeVanitySelling(input: VanityInputs): { total: number; breakdown: VanityBreakdown } {
  const {
    width,
    depth,
    kickplate,
    framingStyle,
    mountingStyle,
    drawers,
    doors,
    thickFrame,
    numberOfSinks,
    doorStyle,
  } = input;

  const widthComponent = width < 24 ? 800 : 800 + 50 * roundUp((width - 24) / 6);
  const depthComponent = depth <= 22 ? 0 : 50 * roundUp((depth - 22) / 3);
  const kickplateComponent = kickplate && width <= 72 ? 50 : 0;
  const framingComponent =
    framingStyle === "Sides only"
      ? 0
      : framingStyle === "Sides and bottom"
        ? 100
        : framingStyle === "Around"
          ? 150
          : framingStyle === "Frame everything"
            ? 300
            : 0;
  const mountingComponent =
    mountingStyle === "Freestanding" || mountingStyle === "Wall-hung"
      ? 0
      : mountingStyle === "Custom legs"
        ? width > 48
          ? 400 + 100 * roundUp((width - 48) / 12)
          : 400
        : mountingStyle === "Box base"
          ? 150
          : 0;
  const drawersComponent = 175 * drawers;
  const doorsComponent = 100 * doors;
  const thickFrameComponent = thickFrame && width <= 60 ? 150 : thickFrame && width > 60 ? 250 : 0;
  const sinksComponent = numberOfSinks === "Single" ? 100 : 150;

  const baseSubtotal =
    widthComponent +
    depthComponent +
    kickplateComponent +
    framingComponent +
    mountingComponent +
    drawersComponent +
    doorsComponent +
    thickFrameComponent +
    sinksComponent;

  const doorMultiplier =
    doorStyle === "Slab/Flat" ? 1 : doorStyle === "Thin Shaker" ? 1.2 : doorStyle === "Standard Shaker" ? 1.15 : 1;

  const total = Math.round(baseSubtotal * doorMultiplier);

  return {
    total,
    breakdown: {
      widthComponent,
      depthComponent,
      kickplateComponent,
      framingComponent,
      mountingComponent,
      drawersComponent,
      doorsComponent,
      thickFrameComponent,
      sinksComponent,
      baseSubtotal,
      doorMultiplier,
      total,
    },
  };
}

/** @deprecated Use computeVanitySelling(input).total */
export function computeVanitySellingTotal(input: VanityInputs): number {
  return computeVanitySelling(input).total;
}
