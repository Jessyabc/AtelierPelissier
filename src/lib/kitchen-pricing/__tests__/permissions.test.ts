import { isKitchenSubmitGateStandardKey } from "@/lib/kitchen-pricing/permissions";

describe("isKitchenSubmitGateStandardKey", () => {
  it("returns true for kitchen room-default keys", () => {
    expect(isKitchenSubmitGateStandardKey("kitchenBaseHeight")).toBe(true);
    expect(isKitchenSubmitGateStandardKey("kitchenBaseDepth")).toBe(true);
    expect(isKitchenSubmitGateStandardKey("kitchenKickplateHeight")).toBe(true);
    expect(isKitchenSubmitGateStandardKey("kitchenTopSilenceHeight")).toBe(true);
  });

  it("returns false for non-kitchen keys so vanity-only pending overrides do not gate submit", () => {
    expect(isKitchenSubmitGateStandardKey("vanityDepthStandard")).toBe(false);
    expect(isKitchenSubmitGateStandardKey("wallHungHeight")).toBe(false);
    expect(isKitchenSubmitGateStandardKey("quoteFollowUpDays")).toBe(false);
  });
});
