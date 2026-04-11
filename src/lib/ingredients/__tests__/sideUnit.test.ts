import { computeSideUnitIngredients } from "../sideUnit";
import type { SideUnitIngredientInputs } from "../sideUnit";
import { CABINET_DEFAULTS, MATERIAL_CODES } from "../types";
import type { SideUnitSection } from "../types";

const defaults = CABINET_DEFAULTS;
const opts = { standards: defaults };

function baseInputs(overrides: Partial<SideUnitIngredientInputs> = {}): SideUnitIngredientInputs {
  return {
    width: 18,
    depth: 16,
    height: 72,
    kickplate: false,
    framingStyle: "Sides only",
    mountingStyle: "Freestanding",
    drawers: 0,
    doors: 0,
    thickFrame: false,
    doorStyle: "Slab/Flat",
    ...overrides,
  };
}

describe("computeSideUnitIngredients", () => {
  describe("legacy mode (no sections)", () => {
    it("produces carcass panels including top panel (fully enclosed)", () => {
      const result = computeSideUnitIngredients(baseInputs(), opts);

      const labels = result.panels.map((p) => p.label);
      expect(labels).toContain("Left side");
      expect(labels).toContain("Right side");
      expect(labels).toContain("Bottom");
      expect(labels).toContain("Top"); // Side units have top panel
      expect(labels).toContain("Back panel");
      expect(labels).toContain("Top stretcher");
    });

    it("generates door fronts for a 2-door unit", () => {
      const result = computeSideUnitIngredients(
        baseInputs({ doors: 2 }),
        opts
      );

      const doorPanels = result.panels.filter((p) => p.category === "door");
      expect(doorPanels.length).toBeGreaterThan(0);

      // Tall doors (72" side unit → ~70" doors) should get 3 hinges each
      const hinges = result.hardware.filter((h) => h.category === "hinges");
      const totalHinges = hinges.reduce((sum, h) => sum + h.quantity, 0);
      expect(totalHinges).toBe(6); // 2 doors × 3 hinges (>= 36" tall)
    });
  });

  describe("section mode (vertical stacking)", () => {
    it("generates horizontal dividers between vertical sections", () => {
      const sections: SideUnitSection[] = [
        { id: "bottom", sortOrder: 0, layoutType: "drawers", height: 20, doors: 0, drawers: 3 },
        { id: "middle", sortOrder: 1, layoutType: "doors", height: 30, doors: 2, drawers: 0 },
        { id: "top", sortOrder: 2, layoutType: "open", height: 20, doors: 0, drawers: 0 },
      ];
      const result = computeSideUnitIngredients(
        baseInputs({ sections }),
        opts
      );

      const dividers = result.panels.find((p) => p.label === "Section dividers");
      expect(dividers).toBeDefined();
      expect(dividers!.qty).toBe(2); // 3 sections → 2 dividers
      // Dividers are horizontal: width of cabinet × depth
      expect(dividers!.lengthIn).toBeCloseTo(18 - 2 * defaults.panelThickness, 2);
      expect(dividers!.widthIn).toBe(16);
    });

    it("generates per-section content correctly", () => {
      const sections: SideUnitSection[] = [
        { id: "bottom", sortOrder: 0, layoutType: "drawers", height: 20, doors: 0, drawers: 3 },
        { id: "top", sortOrder: 1, layoutType: "doors", height: 50, doors: 2, drawers: 0 },
      ];
      const result = computeSideUnitIngredients(
        baseInputs({ sections }),
        opts
      );

      // Bottom section: 3 drawers
      const bottomDrawers = result.panels.filter(
        (p) => p.sectionId === "bottom" && p.category === "drawer"
      );
      expect(bottomDrawers.length).toBeGreaterThan(0);

      // Top section: 2 doors
      const topDoors = result.panels.filter(
        (p) => p.sectionId === "top" && p.category === "door"
      );
      expect(topDoors.length).toBe(1);
      expect(topDoors[0].qty).toBe(2);

      // Metrics
      expect(result.metrics.drawerCount).toBe(3);
      expect(result.metrics.frontCount).toBe(5); // 3 drawers + 2 doors
      expect(result.metrics.dividerCount).toBe(1);
    });

    it("handles open sections with shelves", () => {
      const sections: SideUnitSection[] = [
        { id: "open", sortOrder: 0, layoutType: "open", height: 40, doors: 0, drawers: 0 },
      ];
      const result = computeSideUnitIngredients(
        baseInputs({ sections }),
        opts
      );

      const shelves = result.panels.filter(
        (p) => p.sectionId === "open" && p.category === "shelf"
      );
      expect(shelves.length).toBe(1);
      expect(shelves[0].qty).toBeGreaterThanOrEqual(1);
    });
  });

  describe("kickplate and mounting", () => {
    it("adds kickplate for freestanding", () => {
      const result = computeSideUnitIngredients(
        baseInputs({ kickplate: true }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Kickplate")).toBe(true);
    });

    it("adds hanging rail for wall-hung", () => {
      const result = computeSideUnitIngredients(
        baseInputs({ mountingStyle: "Wall-hung" }),
        opts
      );
      expect(
        result.hardware.some((h) => h.materialCode === MATERIAL_CODES.hangingRail)
      ).toBe(true);
    });
  });
});
