import { blockedReasonLabel, blockedReasonSeverityRank } from "@/lib/blockedReasonLabels";

describe("blockedReasonLabel", () => {
  it("maps known codes", () => {
    expect(blockedReasonLabel("missing_material")).toBe("Missing material");
  });

  it("falls back for unknown codes", () => {
    expect(blockedReasonLabel("custom_code")).toBe("custom code");
  });
});

describe("blockedReasonSeverityRank", () => {
  it("orders missing_material before supplier_delay", () => {
    expect(blockedReasonSeverityRank("missing_material")).toBeLessThan(
      blockedReasonSeverityRank("supplier_delay")
    );
  });
});
