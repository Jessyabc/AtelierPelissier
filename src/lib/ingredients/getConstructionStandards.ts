/**
 * Construction standards accessor — reads admin-editable construction defaults from DB.
 * Follows the same singleton-with-fallback pattern as getAppConfig() in src/lib/config.ts
 * and getEffectiveRiskSettings() in src/lib/risk/getEffectiveRiskSettings.ts.
 *
 * No ingredient engine may use hardcoded construction constants; all must come from this utility.
 */

import { prisma } from "@/lib/db";
import { type ConstructionStandardsData, CABINET_DEFAULTS } from "./types";

/**
 * Load construction standards from DB (singleton).
 * Falls back to CABINET_DEFAULTS if no row exists.
 */
export async function getConstructionStandards(): Promise<ConstructionStandardsData> {
  const row = await prisma.constructionStandards.findFirst();
  if (!row) return { ...CABINET_DEFAULTS };

  return {
    // Shared
    standardBaseDepth: row.standardBaseDepth,
    defaultVanityHeight: row.defaultVanityHeight,
    wallHungHeight: row.wallHungHeight,
    kickplateHeight: row.kickplateHeight,
    panelThickness: row.panelThickness,
    backThickness: row.backThickness,
    stretcherDepth: row.stretcherDepth,
    framingWidth: row.framingWidth,
    drawerBoxHeight: row.drawerBoxHeight,
    drawerFrontHeight: row.drawerFrontHeight,
    doorGap: row.doorGap,
    shelfSetback: row.shelfSetback,
    thickFrameThickness: row.thickFrameThickness,
    minSectionWidth: row.minSectionWidth,
    minSectionHeight: row.minSectionHeight,
    // Not yet persisted on the ConstructionStandards row — fall back to the
    // hardcoded default. When the admin UI gets a field for this we can
    // plumb it through the Prisma model.
    finishPanelThickness: CABINET_DEFAULTS.finishPanelThickness,
    // Vanity
    vanityFreestandingHeight: row.vanityFreestandingHeight,
    vanityDepthStandard: row.vanityDepthStandard,
    vanityDepthWallMountedFaucet: row.vanityDepthWallMountedFaucet,
    // Kitchen
    kitchenBaseHeight: row.kitchenBaseHeight,
    kitchenBaseDepth: row.kitchenBaseDepth,
    kitchenKickplateHeight: row.kitchenKickplateHeight,
    kitchenTopSilenceHeight: row.kitchenTopSilenceHeight,
    // Sales follow-up thresholds — tuned by admins to pace the sales team.
    quoteFollowUpDays: row.quoteFollowUpDays,
    invoiceFollowUpDays: row.invoiceFollowUpDays,
  };
}
