import {
  getApprovalTier,
  canApprove,
  classifyOverride,
} from "@/lib/standards/overridePolicy";

describe("overridePolicy — getApprovalTier", () => {
  it("returns 'high' for kitchen base height", () => {
    expect(getApprovalTier("kitchenBaseHeight")).toBe("high");
  });

  it("returns 'high' for vanity freestanding height", () => {
    expect(getApprovalTier("vanityFreestandingHeight")).toBe("high");
  });

  it("returns 'high' for sheet-good thicknesses", () => {
    expect(getApprovalTier("panelThickness")).toBe("high");
    expect(getApprovalTier("backThickness")).toBe("high");
  });

  it("returns 'low' for kitchen base depth (local tweak)", () => {
    expect(getApprovalTier("kitchenBaseDepth")).toBe("low");
  });

  it("returns 'low' for vanity depths", () => {
    expect(getApprovalTier("vanityDepthStandard")).toBe("low");
    expect(getApprovalTier("vanityDepthWallMountedFaucet")).toBe("low");
  });

  it("returns 'low' for unknown / newly-added keys (default-trust-planner)", () => {
    expect(getApprovalTier("totallyNewStandardIMadeUp")).toBe("low");
  });
});

describe("overridePolicy — canApprove", () => {
  it("admin can approve any tier", () => {
    expect(canApprove("admin", "low")).toBe(true);
    expect(canApprove("admin", "high")).toBe(true);
  });

  it("planner can only approve low-tier overrides", () => {
    expect(canApprove("planner", "low")).toBe(true);
    expect(canApprove("planner", "high")).toBe(false);
  });

  it("salesperson cannot approve anything", () => {
    expect(canApprove("salesperson", "low")).toBe(false);
    expect(canApprove("salesperson", "high")).toBe(false);
  });

  it("woodworker cannot approve anything", () => {
    expect(canApprove("woodworker", "low")).toBe(false);
    expect(canApprove("woodworker", "high")).toBe(false);
  });
});

describe("overridePolicy — classifyOverride", () => {
  it("returns structured tier + label for high-risk key", () => {
    expect(classifyOverride("kitchenBaseHeight")).toEqual({
      key: "kitchenBaseHeight",
      tier: "high",
      reviewLabel: "Admin review",
    });
  });

  it("returns structured tier + label for low-risk key", () => {
    expect(classifyOverride("kitchenBaseDepth")).toEqual({
      key: "kitchenBaseDepth",
      tier: "low",
      reviewLabel: "Planner review",
    });
  });
});
