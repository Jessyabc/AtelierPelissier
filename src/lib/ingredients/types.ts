/**
 * Configuration-to-Material-Truth Subsystem — Type Definitions
 *
 * TERMINOLOGY (enforced throughout this subsystem):
 * - "Live estimate" = computed on-the-fly from current config. Not persisted. Changes as user edits.
 * - "Saved snapshot" = persisted material state written to PanelPart + PrerequisiteLine rows.
 *   The project's operational material truth until config changes.
 * - "Stale snapshot" = saved snapshot whose source config changed since save.
 *   Must be regenerated before production use.
 * - "Shortage / inventory" = downstream system reading the saved snapshot. Out of scope here.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

export type VanitySectionLayout =
  | "doors"
  | "drawer_over_doors"
  | "doors_over_drawer"
  | "all_drawers"
  | "open";

export type SideUnitSectionLayout = "doors" | "drawers" | "open";

export type VanitySection = {
  id: string;
  sortOrder: number; // 0 = leftmost
  layoutType: VanitySectionLayout;
  /**
   * Section width in inches. Represents the exterior slice of the overall
   * vanity that this section occupies (including its own 5/8" side walls
   * but NOT the outer 3/4" finishing panels). Minimum 8" is enforced at
   * save-time in the API, not in the UI, so users can type freely.
   */
  width: number;
  doors: number; // 0–4
  drawers: number; // 0–4
  /**
   * When true, the top drawer in this section is built as a U-shape so it
   * wraps around the sink plumbing. Only meaningful for sections with a
   * top drawer (drawer_over_doors / all_drawers).
   */
  hasSink?: boolean;
};

export type SideUnitSection = {
  id: string;
  sortOrder: number; // 0 = bottom
  layoutType: SideUnitSectionLayout;
  height: number; // inches, min 5"
  doors: number;
  drawers: number;
};

// ---------------------------------------------------------------------------
// Engine output types
// ---------------------------------------------------------------------------

export type PanelCategory =
  | "carcass"
  | "door"
  | "drawer"
  | "framing"
  | "kickplate"
  | "stretcher"
  | "divider"
  | "shelf";

export type EstimatedPanel = {
  label: string;
  lengthIn: number;
  widthIn: number;
  qty: number;
  materialCode: string;
  thicknessIn: number;
  category: PanelCategory;
  edgeBandedEdges: number; // 0–4
  sectionId?: string;
};

export type HardwareCategory = "hinges" | "drawer_boxes" | "finishing" | "other";

export type EstimatedHardware = {
  materialCode: string;
  category: HardwareCategory;
  quantity: number;
  label: string;
};

export type SheetEstimate = {
  materialCode: string;
  totalAreaSqIn: number;
  sheetAreaSqIn: number;
  rawSheets: number;
  sheetsNeeded: number;
  panelCount: number;
};

/** Future-hook metrics for internal cost, production time, scheduling weight */
export type EstimateMetrics = {
  frontCount: number;
  drawerCount: number;
  hingeCount: number;
  dividerCount: number;
  panelCount: number;
  complexityScore: number;
};

export type IngredientEstimate = {
  panels: EstimatedPanel[];
  hardware: EstimatedHardware[];
  edgeBandingTotalIn: number;
  sheetEstimates: SheetEstimate[];
  totalPanelCount: number;
  totalHardwareItems: number;
  metrics: EstimateMetrics;
};

// ---------------------------------------------------------------------------
// Configuration warnings
// ---------------------------------------------------------------------------

export type ConfigWarningSeverity = "info" | "warning";

export type ConfigWarning = {
  code: string;
  severity: ConfigWarningSeverity;
  message: string;
  sectionId?: string;
};

// ---------------------------------------------------------------------------
// Construction standards (mirrors ConstructionStandards Prisma model)
// ---------------------------------------------------------------------------

export type ConstructionStandardsData = {
  standardBaseDepth: number;
  defaultVanityHeight: number;
  wallHungHeight: number;
  kickplateHeight: number;
  panelThickness: number;
  backThickness: number;
  stretcherDepth: number;
  framingWidth: number;
  drawerBoxHeight: number;
  drawerFrontHeight: number;
  doorGap: number;
  shelfSetback: number;
  thickFrameThickness: number;
  minSectionWidth: number;
  minSectionHeight: number;
  /**
   * Thickness of the two outer finishing panels (left + right) that wrap a
   * vanity. Always added regardless of framing style — the total vanity
   * width the shop buys material for is
   *   sum(section.width) + 2 × finishPanelThickness.
   */
  finishPanelThickness: number;
};

/** Hardcoded fallback defaults — used only if no ConstructionStandards row exists in DB */
export const CABINET_DEFAULTS: ConstructionStandardsData = {
  standardBaseDepth: 23.5,
  defaultVanityHeight: 30,
  wallHungHeight: 24,
  kickplateHeight: 4,
  panelThickness: 0.625,
  backThickness: 0.25,
  stretcherDepth: 3.5,
  framingWidth: 1.5,
  drawerBoxHeight: 6,
  drawerFrontHeight: 7,
  doorGap: 0.125,
  shelfSetback: 1,
  thickFrameThickness: 0.75,
  minSectionWidth: 8,
  minSectionHeight: 5,
  finishPanelThickness: 0.75,
};

// ---------------------------------------------------------------------------
// Default material codes (from AppConfig materialAliases)
// ---------------------------------------------------------------------------

export const MATERIAL_CODES = {
  carcass: "MEL-WHT-5/8-4x8",
  back: "HB-WHT-1/4-4x8",
  hinge: "HW-HINGE",
  drawerKit: "HW-DRAWER-KIT",
  handle: "HW-HANDLE",
  edgeBanding: "EDGE",
  hangingRail: "HW-HANGING-RAIL",
} as const;

// ---------------------------------------------------------------------------
// Config hash — deterministic hash of ingredient-driving fields
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of all fields that affect ingredient output.
 * Any change to these fields means the saved snapshot is stale.
 */
export function computeConfigHash(inputs: Record<string, unknown>): string {
  // Extract only ingredient-driving fields, sorted for determinism
  const drivingKeys = [
    "width",
    "height",
    "depth",
    "sections",
    "mountingStyle",
    "framingStyle",
    "kickplate",
    "doorStyle",
    "thickFrame",
    "countertop",
    "numberOfSinks",
    "sinks",
    "faucetHoles",
    "doors",
    "drawers",
  ];
  const subset: Record<string, unknown> = {};
  for (const key of drivingKeys) {
    if (key in inputs) {
      subset[key] = inputs[key];
    }
  }
  return createHash("sha256").update(JSON.stringify(subset)).digest("hex");
}
