import { computeVanityIngredients } from "../vanity";
import type { VanityIngredientInputs } from "../vanity";
import { CABINET_DEFAULTS, MATERIAL_CODES } from "../types";
import type { VanitySection } from "../types";

const defaults = CABINET_DEFAULTS;
const opts = { standards: defaults };

function baseInputs(overrides: Partial<VanityIngredientInputs> = {}): VanityIngredientInputs {
  return {
    width: 24,
    depth: 22,
    kickplate: false,
    framingStyle: "Sides only",
    mountingStyle: "Freestanding",
    drawers: 0,
    doors: 0,
    thickFrame: false,
    numberOfSinks: "Single",
    doorStyle: "Slab/Flat",
    ...overrides,
  };
}

describe("computeVanityIngredients", () => {
  describe("legacy mode (no sections)", () => {
    it("produces carcass panels for base vanity with no doors/drawers", () => {
      const result = computeVanityIngredients(baseInputs(), opts);

      const labels = result.panels.map((p) => p.label);
      expect(labels).toContain("Left side");
      expect(labels).toContain("Right side");
      expect(labels).toContain("Bottom");
      expect(labels).toContain("Back panel");
      expect(labels).toContain("Top stretcher");

      // No doors or drawers → no section dividers, no fronts
      expect(labels.filter((l) => l.includes("Door front"))).toHaveLength(0);
      expect(labels.filter((l) => l.includes("Drawer front"))).toHaveLength(0);
      expect(result.hardware).toHaveLength(0);
    });

    it("generates door fronts + hinges + handles for 2-door vanity", () => {
      const result = computeVanityIngredients(
        baseInputs({ doors: 2 }),
        opts
      );

      const doorPanels = result.panels.filter((p) => p.category === "door");
      expect(doorPanels.length).toBeGreaterThan(0);
      expect(doorPanels[0].qty).toBe(2);

      // Hinges: 2 per door (< 36" tall) = 4
      const hinges = result.hardware.filter((h) => h.category === "hinges");
      expect(hinges.reduce((sum, h) => sum + h.quantity, 0)).toBe(4);

      // Handles: 1 per door = 2
      const handles = result.hardware.filter(
        (h) => h.materialCode === MATERIAL_CODES.handle
      );
      expect(handles.reduce((sum, h) => sum + h.quantity, 0)).toBe(2);
    });

    it("generates drawer box panels + kits for 1-drawer + 1-door vanity", () => {
      const result = computeVanityIngredients(
        baseInputs({ drawers: 1, doors: 1 }),
        opts
      );

      const drawerPanels = result.panels.filter((p) => p.category === "drawer");
      expect(drawerPanels.length).toBeGreaterThan(0);

      // Drawer box: sides(2) + F/B(2) + bottom(1) = 3 panel entries per drawer
      // Plus the drawer front itself = 4 entries
      const drawerLabels = drawerPanels.map((p) => p.label);
      expect(drawerLabels.some((l) => l.includes("Drawer front"))).toBe(true);
      expect(drawerLabels.some((l) => l.includes("Drawer box sides"))).toBe(true);
      expect(drawerLabels.some((l) => l.includes("Drawer box F/B"))).toBe(true);
      expect(drawerLabels.some((l) => l.includes("Drawer box bottom"))).toBe(true);

      // Drawer kit
      const kits = result.hardware.filter((h) => h.category === "drawer_boxes");
      expect(kits.reduce((sum, h) => sum + h.quantity, 0)).toBe(1);
    });
  });

  describe("framing styles", () => {
    it("adds bottom frame for 'Sides and bottom'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Sides and bottom" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top frame")).toBe(false);
    });

    it("adds bottom + top frame for 'Around'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Around" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Side frames")).toBe(false);
    });

    it("adds all framing for 'Frame everything'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Frame everything" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Side frames")).toBe(true);
    });
  });

  describe("kickplate and mounting", () => {
    it("adds kickplate panel when enabled", () => {
      const result = computeVanityIngredients(
        baseInputs({ kickplate: true }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Kickplate")).toBe(true);
    });

    it("does NOT add kickplate for wall-hung", () => {
      const result = computeVanityIngredients(
        baseInputs({ kickplate: true, mountingStyle: "Wall-hung" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Kickplate")).toBe(false);
    });

    it("uses wall-hung height (24) when wall-hung", () => {
      const result = computeVanityIngredients(
        baseInputs({ mountingStyle: "Wall-hung" }),
        opts
      );
      const leftSide = result.panels.find((p) => p.label === "Left side");
      expect(leftSide?.lengthIn).toBe(24);
    });

    it("adds hanging rail hardware for wall-hung", () => {
      const result = computeVanityIngredients(
        baseInputs({ mountingStyle: "Wall-hung" }),
        opts
      );
      expect(
        result.hardware.some((h) => h.materialCode === MATERIAL_CODES.hangingRail)
      ).toBe(true);
    });

    it("adds box base panels for Box base mounting", () => {
      const result = computeVanityIngredients(
        baseInputs({ mountingStyle: "Box base" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Box base front")).toBe(true);
      expect(result.panels.some((p) => p.label === "Box base sides")).toBe(true);
    });
  });

  describe("section mode", () => {
    it("generates section divider for 2 sections", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 1, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "all_drawers", width: 12, doors: 0, drawers: 2 },
      ];
      const result = computeVanityIngredients(
        baseInputs({ sections }),
        opts
      );

      expect(result.panels.some((p) => p.label === "Section dividers")).toBe(true);
      const divider = result.panels.find((p) => p.label === "Section dividers");
      expect(divider?.qty).toBe(1);
    });

    it("generates per-section door fronts and drawer fronts", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 2, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "all_drawers", width: 12, doors: 0, drawers: 3 },
      ];
      const result = computeVanityIngredients(
        baseInputs({ sections }),
        opts
      );

      const s1Doors = result.panels.filter(
        (p) => p.sectionId === "s1" && p.category === "door"
      );
      expect(s1Doors.length).toBe(1);
      expect(s1Doors[0].qty).toBe(2);

      const s2Drawers = result.panels.filter(
        (p) => p.sectionId === "s2" && p.category === "drawer"
      );
      expect(s2Drawers.length).toBeGreaterThan(0);
    });

    it("computes metrics correctly", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 2, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "all_drawers", width: 12, doors: 0, drawers: 2 },
      ];
      const result = computeVanityIngredients(
        baseInputs({ sections }),
        opts
      );

      expect(result.metrics.frontCount).toBe(4); // 2 doors + 2 drawers
      expect(result.metrics.drawerCount).toBe(2);
      expect(result.metrics.dividerCount).toBe(1);
      expect(result.metrics.hingeCount).toBe(4); // 2 doors × 2 hinges
      expect(result.metrics.complexityScore).toBeGreaterThan(0);
    });
  });

  describe("sheet estimates", () => {
    it("produces sheet estimates grouped by material code", () => {
      const result = computeVanityIngredients(
        baseInputs({ doors: 2, drawers: 1 }),
        opts
      );

      expect(result.sheetEstimates.length).toBeGreaterThan(0);
      // Should have at least carcass material
      expect(
        result.sheetEstimates.some(
          (s) => s.materialCode === MATERIAL_CODES.carcass
        )
      ).toBe(true);
      // Sheet count should be at least 1
      for (const sheet of result.sheetEstimates) {
        expect(sheet.sheetsNeeded).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("explicit height", () => {
    it("uses provided height instead of default", () => {
      const result = computeVanityIngredients(
        baseInputs({ height: 36 }),
        opts
      );
      const leftSide = result.panels.find((p) => p.label === "Left side");
      expect(leftSide?.lengthIn).toBe(36);
    });
  });
});
