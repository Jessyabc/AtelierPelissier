import {
  pickActiveOverride,
  resolveStandard,
  type StandardsOverrideDTO,
} from "@/components/standards/overrideResolver";
import { CABINET_DEFAULTS } from "@/lib/ingredients/types";

function row(partial: Partial<StandardsOverrideDTO>): StandardsOverrideDTO {
  return {
    id: partial.id ?? Math.random().toString(),
    projectId: partial.projectId ?? "p1",
    standardKey: partial.standardKey ?? "kitchenBaseHeight",
    standardValue: partial.standardValue ?? 34.75,
    overrideValue: partial.overrideValue ?? 36,
    unit: partial.unit ?? "in",
    sectionId: partial.sectionId ?? null,
    riskTier: partial.riskTier ?? "high",
    reason: partial.reason ?? null,
    status: partial.status ?? "pending",
    createdAt: partial.createdAt ?? "2026-04-17T12:00:00Z",
    reviewedAt: partial.reviewedAt ?? null,
  };
}

describe("pickActiveOverride", () => {
  it("returns null when no rows match the key", () => {
    const rows = [row({ standardKey: "vanityFreestandingHeight" })];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)).toBeNull();
  });

  it("picks the only matching row for a key", () => {
    const rows = [row({ id: "a", standardKey: "kitchenBaseHeight" })];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)?.id).toBe("a");
  });

  it("prefers approved over pending (same key, project-level)", () => {
    const rows = [
      row({ id: "pending", status: "pending", createdAt: "2026-04-17T13:00:00Z" }),
      row({ id: "approved", status: "approved", createdAt: "2026-04-17T12:00:00Z" }),
    ];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)?.id).toBe("approved");
  });

  it("prefers pending over rejected", () => {
    const rows = [
      row({ id: "rejected", status: "rejected", createdAt: "2026-04-17T13:00:00Z" }),
      row({ id: "pending", status: "pending", createdAt: "2026-04-17T12:00:00Z" }),
    ];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)?.id).toBe("pending");
  });

  it("breaks ties by most recent createdAt", () => {
    const rows = [
      row({ id: "old", status: "pending", createdAt: "2026-04-17T10:00:00Z" }),
      row({ id: "new", status: "pending", createdAt: "2026-04-17T13:00:00Z" }),
    ];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)?.id).toBe("new");
  });

  it("ignores section-specific rows when caller asks for project-level", () => {
    const rows = [row({ id: "s1", sectionId: "cab-1" })];
    expect(pickActiveOverride(rows, "kitchenBaseHeight", null)).toBeNull();
  });

  it("prefers section-specific rows when caller passes a sectionId", () => {
    const rows = [
      row({ id: "proj", sectionId: null, status: "approved" }),
      row({ id: "sec", sectionId: "cab-1", status: "pending" }),
    ];
    expect(
      pickActiveOverride(rows, "kitchenBaseHeight", "cab-1")?.id
    ).toBe("sec");
  });

  it("falls back to project-level when section has no override", () => {
    const rows = [row({ id: "proj", sectionId: null, status: "approved" })];
    expect(
      pickActiveOverride(rows, "kitchenBaseHeight", "cab-1")?.id
    ).toBe("proj");
  });
});

describe("resolveStandard", () => {
  it("returns the canonical value when no overrides exist", () => {
    const r = resolveStandard(CABINET_DEFAULTS, [], "kitchenBaseHeight");
    expect(r.value).toBe(CABINET_DEFAULTS.kitchenBaseHeight);
    expect(r.source).toBe("standard");
    expect(r.override).toBeNull();
    expect(r.provenanceLabel).toBe("Standard");
  });

  it("uses the approved override value", () => {
    const rows = [row({ status: "approved", overrideValue: 36, standardKey: "kitchenBaseHeight" })];
    const r = resolveStandard(CABINET_DEFAULTS, rows, "kitchenBaseHeight");
    expect(r.value).toBe(36);
    expect(r.source).toBe("override-approved");
    expect(r.provenanceLabel).toBe("Override approved");
  });

  it("keeps the canonical value for pending overrides (pricing stays honest)", () => {
    const rows = [row({ status: "pending", overrideValue: 36, standardKey: "kitchenBaseHeight" })];
    const r = resolveStandard(CABINET_DEFAULTS, rows, "kitchenBaseHeight");
    expect(r.value).toBe(CABINET_DEFAULTS.kitchenBaseHeight);
    expect(r.source).toBe("override-pending");
  });

  it("falls back to canonical for rejected overrides", () => {
    const rows = [row({ status: "rejected", overrideValue: 36, standardKey: "kitchenBaseHeight" })];
    const r = resolveStandard(CABINET_DEFAULTS, rows, "kitchenBaseHeight");
    expect(r.value).toBe(CABINET_DEFAULTS.kitchenBaseHeight);
    expect(r.source).toBe("override-rejected");
    expect(r.provenanceLabel).toBe("Override rejected — showing standard");
  });

  it("classifies tier via the shared policy", () => {
    // kitchenBaseHeight is high-risk (see HIGH_RISK_KEYS in overridePolicy).
    const high = resolveStandard(CABINET_DEFAULTS, [], "kitchenBaseHeight");
    expect(high.tier).toBe("high");
    // vanityDepthStandard is not flagged high-risk — should be low.
    const low = resolveStandard(CABINET_DEFAULTS, [], "vanityDepthStandard");
    expect(low.tier).toBe("low");
  });

  it("scopes to section when sectionId is provided", () => {
    const rows = [
      row({ sectionId: "cab-1", status: "approved", overrideValue: 40 }),
      row({ sectionId: null, status: "approved", overrideValue: 38 }),
    ];
    const r = resolveStandard(CABINET_DEFAULTS, rows, "kitchenBaseHeight", "cab-1");
    expect(r.value).toBe(40);
  });
});
