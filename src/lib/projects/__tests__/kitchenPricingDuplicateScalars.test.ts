import { kitchenPricingProjectDuplicateScalars } from "@/lib/projects/kitchenPricingDuplicateScalars";

describe("kitchenPricingProjectDuplicateScalars", () => {
  it("preserves TBD flags and room defaults from the source row", () => {
    const roomDefaults = { ceilingHeightIn: 96 };
    const src = {
      roomDefaults,
      includeInstallation: true,
      installationTbd: true,
      includeDelivery: true,
      deliveryTbd: true,
      deliveryCost: 123.45,
      multiplier: 2.2,
      discountPercent: 5,
      discountReason: "promo",
    };
    expect(kitchenPricingProjectDuplicateScalars(src)).toEqual(src);
  });
});
