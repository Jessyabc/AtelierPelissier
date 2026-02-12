/**
 * Side unit selling price formula (Monday.com exact replica).
 * All dimensions in inches. Pure function; returns { total, breakdown }.
 */

export type SideUnitInputs = {
  width: number;
  depth: number;
  height: number;
  kickplate: boolean;
  framingStyle: "Sides only" | "Sides and bottom" | "Around" | "Frame everything";
  mountingStyle: "Freestanding" | "Wall-hung" | "Custom legs" | "Box base";
  drawers: number;
  doors: number;
  thickFrame: boolean;
  doorStyle: "Slab/Flat" | "Thin Shaker" | "Standard Shaker";
};

export type SideUnitBreakdown = {
  widthComponent: number;
  depthComponent: number;
  heightComponent: number;
  kickplateComponent: number;
  framingComponent: number;
  mountingComponent: number;
  drawersComponent: number;
  doorsComponent: number;
  thickFrameComponent: number;
  baseSubtotal: number;
  doorMultiplier: number;
  total: number;
};

function roundUp(value: number): number {
  return Math.ceil(value);
}

export function computeSideUnitSelling(input: SideUnitInputs): { total: number; breakdown: SideUnitBreakdown } {
  const {
    width,
    depth,
    height,
    kickplate,
    framingStyle,
    mountingStyle,
    drawers,
    doors,
    thickFrame,
    doorStyle,
  } = input;

  const widthComponent = width < 18 ? 1000 : 1000 + 50 * roundUp((width - 18) / 6);
  const depthComponent = depth <= 16 ? 0 : 50 * roundUp((depth - 16) / 3);
  const heightComponent = height <= 72 ? 0 : 50 * roundUp((height - 72) / 6);
  const kickplateComponent = kickplate
    ? width <= 18
      ? 50
      : 50 + 10 * roundUp((width - 18) / 6)
    : 0;
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
        ? width < 20
          ? 400 + 100 * roundUp((width - 20) / 6)
          : 400
        : mountingStyle === "Box base"
          ? 150
          : 0;
  const drawersComponent = 175 * drawers;
  const doorsComponent = 100 * doors;
  const thickFrameComponent = thickFrame
    ? width <= 20
      ? 150
      : 150 + 50 * roundUp((width - 20) / 12)
    : 0;

  const baseSubtotal =
    widthComponent +
    depthComponent +
    heightComponent +
    kickplateComponent +
    framingComponent +
    mountingComponent +
    drawersComponent +
    doorsComponent +
    thickFrameComponent;

  const doorMultiplier =
    doorStyle === "Slab/Flat" ? 1 : doorStyle === "Thin Shaker" ? 1.2 : doorStyle === "Standard Shaker" ? 1.15 : 1;

  const total = Math.round(baseSubtotal * doorMultiplier);

  return {
    total,
    breakdown: {
      widthComponent,
      depthComponent,
      heightComponent,
      kickplateComponent,
      framingComponent,
      mountingComponent,
      drawersComponent,
      doorsComponent,
      thickFrameComponent,
      baseSubtotal,
      doorMultiplier,
      total,
    },
  };
}

/** @deprecated Use computeSideUnitSelling(input).total */
export function computeSideUnitSellingTotal(input: SideUnitInputs): number {
  return computeSideUnitSelling(input).total;
}
