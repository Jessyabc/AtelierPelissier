import { z } from "zod";
import type { ConstructionStandardsData } from "@/lib/ingredients/types";
import { CABINET_DEFAULTS } from "@/lib/ingredients/types";

/**
 * Stage 1 — "room defaults" for the kitchen builder: the dimensional frame
 * salespeople agree on before cabinet-by-cabinet pricing. Values align with
 * Admin → Construction Standards where applicable; ceiling height is shop
 * convention (96" typical) rather than a persisted standard row.
 */
export type KitchenRoomDefaults = {
  /** Finished ceiling height — used for full-height pantry / panel planning. */
  ceilingHeightInches: number;
  /** Floor to top of base cabinet box (before countertop). */
  baseCabinetHeightInches: number;
  /** Standard base cabinet carcass depth. */
  baseCabinetDepthInches: number;
  /** Toe-kick / plinth under base cabinets. */
  kickplateHeightInches: number;
  /**
   * Band between top of wall cabinets and ceiling on floor-to-ceiling runs.
   */
  topCabinetSilenceInches: number;
};

/** Typical residential ceiling when no field measure yet — not on ConstructionStandards. */
export const DEFAULT_KITCHEN_CEILING_HEIGHT_INCHES = 96;

export const kitchenRoomDefaultsSchema = z.object({
  ceilingHeightInches: z.number().min(72).max(168),
  baseCabinetHeightInches: z.number().min(30).max(48),
  baseCabinetDepthInches: z.number().min(12).max(36),
  kickplateHeightInches: z.number().min(0).max(12),
  topCabinetSilenceInches: z.number().min(0).max(12),
});

/** Hard fallback when DB standards are unavailable (matches CABINET_DEFAULTS kitchen slice). */
export function staticKitchenRoomDefaults(): KitchenRoomDefaults {
  return {
    ceilingHeightInches: DEFAULT_KITCHEN_CEILING_HEIGHT_INCHES,
    baseCabinetHeightInches: CABINET_DEFAULTS.kitchenBaseHeight,
    baseCabinetDepthInches: CABINET_DEFAULTS.kitchenBaseDepth,
    kickplateHeightInches: CABINET_DEFAULTS.kitchenKickplateHeight,
    topCabinetSilenceInches: CABINET_DEFAULTS.kitchenTopSilenceHeight,
  };
}

export function kitchenRoomDefaultsFromStandards(s: ConstructionStandardsData): KitchenRoomDefaults {
  return {
    ceilingHeightInches: DEFAULT_KITCHEN_CEILING_HEIGHT_INCHES,
    baseCabinetHeightInches: s.kitchenBaseHeight,
    baseCabinetDepthInches: s.kitchenBaseDepth,
    kickplateHeightInches: s.kitchenKickplateHeight,
    topCabinetSilenceInches: s.kitchenTopSilenceHeight,
  };
}

/**
 * Merge persisted JSON (may be partial / from an older client) onto the
 * current shop defaults so GET always returns a complete object.
 */
export function mergeKitchenRoomDefaults(
  stored: unknown,
  standards: ConstructionStandardsData
): KitchenRoomDefaults {
  const base = kitchenRoomDefaultsFromStandards(standards);
  if (stored == null || typeof stored !== "object") return base;
  const raw = stored as Record<string, unknown>;
  const merged: KitchenRoomDefaults = {
    ceilingHeightInches:
      typeof raw.ceilingHeightInches === "number" ? raw.ceilingHeightInches : base.ceilingHeightInches,
    baseCabinetHeightInches:
      typeof raw.baseCabinetHeightInches === "number"
        ? raw.baseCabinetHeightInches
        : base.baseCabinetHeightInches,
    baseCabinetDepthInches:
      typeof raw.baseCabinetDepthInches === "number"
        ? raw.baseCabinetDepthInches
        : base.baseCabinetDepthInches,
    kickplateHeightInches:
      typeof raw.kickplateHeightInches === "number"
        ? raw.kickplateHeightInches
        : base.kickplateHeightInches,
    topCabinetSilenceInches:
      typeof raw.topCabinetSilenceInches === "number"
        ? raw.topCabinetSilenceInches
        : base.topCabinetSilenceInches,
  };
  const parsed = kitchenRoomDefaultsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

/** Usable interior height for base doors/drawers (informational). */
export function usableBaseCabinetOpeningInches(d: KitchenRoomDefaults): number {
  return Math.round((d.baseCabinetHeightInches - d.kickplateHeightInches) * 1000) / 1000;
}
