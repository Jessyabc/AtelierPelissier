import { computeConfigWarnings } from "../warnings";
import { CABINET_DEFAULTS } from "../types";
import type { VanitySection, SideUnitSection } from "../types";

const standards = CABINET_DEFAULTS;

describe("computeConfigWarnings", () => {
  it("warns about wide wall-mounted cabinet", () => {
    const warnings = computeConfigWarnings(
      { width: 60, depth: 22, mountingStyle: "Wall-hung", kickplate: false },
      standards
    );
    expect(warnings.some((w) => w.code === "WIDE_WALL_MOUNT")).toBe(true);
  });

  it("does not warn about normal width wall-mounted", () => {
    const warnings = computeConfigWarnings(
      { width: 36, depth: 22, mountingStyle: "Wall-hung", kickplate: false },
      standards
    );
    expect(warnings.some((w) => w.code === "WIDE_WALL_MOUNT")).toBe(false);
  });

  it("warns about deep cabinet exceeding standard", () => {
    const warnings = computeConfigWarnings(
      { width: 24, depth: 32, mountingStyle: "Freestanding", kickplate: false },
      standards
    );
    expect(warnings.some((w) => w.code === "DEEP_CABINET")).toBe(true);
  });

  it("warns about sink with all-drawers section", () => {
    const sections: VanitySection[] = [
      { id: "s1", sortOrder: 0, layoutType: "all_drawers", width: 24, doors: 0, drawers: 3 },
    ];
    const warnings = computeConfigWarnings(
      {
        width: 24,
        depth: 22,
        mountingStyle: "Freestanding",
        kickplate: false,
        sections,
        numberOfSinks: "Single",
      },
      standards
    );
    expect(warnings.some((w) => w.code === "SINK_WITH_ALL_DRAWERS")).toBe(true);
  });

  it("warns about narrow section with doors", () => {
    const sections: VanitySection[] = [
      { id: "s1", sortOrder: 0, layoutType: "doors", width: 10, doors: 1, drawers: 0 },
    ];
    const warnings = computeConfigWarnings(
      { width: 24, depth: 22, mountingStyle: "Freestanding", kickplate: false, sections },
      standards
    );
    expect(warnings.some((w) => w.code === "NARROW_SECTION_DOORS")).toBe(true);
  });

  it("warns about short side unit section with doors", () => {
    const sections: SideUnitSection[] = [
      { id: "s1", sortOrder: 0, layoutType: "doors", height: 6, doors: 1, drawers: 0 },
    ];
    const warnings = computeConfigWarnings(
      { width: 18, depth: 16, height: 72, mountingStyle: "Freestanding", kickplate: false, sections },
      standards
    );
    expect(warnings.some((w) => w.code === "SHORT_SECTION_DOORS")).toBe(true);
  });

  it("warns about unbalanced section widths", () => {
    const sections: VanitySection[] = [
      { id: "s1", sortOrder: 0, layoutType: "doors", width: 8, doors: 1, drawers: 0 },
      { id: "s2", sortOrder: 1, layoutType: "doors", width: 40, doors: 2, drawers: 0 },
    ];
    const warnings = computeConfigWarnings(
      { width: 48, depth: 22, mountingStyle: "Freestanding", kickplate: false, sections },
      standards
    );
    expect(warnings.some((w) => w.code === "UNBALANCED_SECTIONS")).toBe(true);
  });

  it("returns empty for a normal configuration", () => {
    const warnings = computeConfigWarnings(
      { width: 36, depth: 22, mountingStyle: "Freestanding", kickplate: false },
      standards
    );
    expect(warnings).toHaveLength(0);
  });
});
