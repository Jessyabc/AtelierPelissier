/**
 * Configuration-to-Material-Truth Subsystem — Barrel Export
 *
 * The section configurator defines the build structure.
 * The material engine translates that structure into BOM truth.
 * The saved snapshot becomes the project's current material reference
 * until the configuration changes again.
 */

// Types
export type {
  VanitySection,
  SideUnitSection,
  VanitySectionLayout,
  SideUnitSectionLayout,
  EstimatedPanel,
  EstimatedHardware,
  SheetEstimate,
  IngredientEstimate,
  EstimateMetrics,
  ConfigWarning,
  ConstructionStandardsData,
  PanelCategory,
  HardwareCategory,
} from "./types";
export { CABINET_DEFAULTS, MATERIAL_CODES, computeConfigHash } from "./types";

// Engines
export { computeVanityIngredients } from "./vanity";
export type { VanityIngredientInputs, VanityIngredientOptions } from "./vanity";
export { computeSideUnitIngredients } from "./sideUnit";
export type { SideUnitIngredientInputs, SideUnitIngredientOptions } from "./sideUnit";

// Sheet estimation
export { computeSheetEstimates } from "./sheetEstimate";
export type { SheetFormat } from "./sheetEstimate";

// Warnings
export { computeConfigWarnings } from "./warnings";

// Standards accessor
export { getConstructionStandards } from "./getConstructionStandards";

// Snapshot persistence
export { saveSnapshot, markSnapshotStale, getActiveSnapshot } from "./snapshot";
export type { SnapshotSourceType } from "./snapshot";
