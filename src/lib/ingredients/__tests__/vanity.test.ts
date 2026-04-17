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

describe("computeVanityIngredients (modular-box model)", () => {
  describe("legacy mode (no sections)", () => {
    it("emits the two outer finishing panels + one implicit section carcass", () => {
      const result = computeVanityIngredients(baseInputs(), opts);
      const labels = result.panels.map((p) => p.label);

      expect(labels).toContain("Left finishing panel");
      expect(labels).toContain("Right finishing panel");

      // Modular box panels for the implicit section are tagged with the
      // legacy section id.
      expect(labels.some((l) => l.startsWith("Sides ("))).toBe(true);
      expect(labels.some((l) => l.startsWith("Bottom ("))).toBe(true);
      expect(labels.some((l) => l.startsWith("Top front stretcher ("))).toBe(true);
      expect(labels.some((l) => l.startsWith("Top back stretcher ("))).toBe(true);
      expect(labels.some((l) => l.startsWith("Back ("))).toBe(true);
    });

    it("back panels now use the 5/8\" carcass material, not 1/4\" hardboard", () => {
      const result = computeVanityIngredients(baseInputs(), opts);
      const back = result.panels.find((p) => p.label.startsWith("Back ("));
      expect(back).toBeDefined();
      expect(back?.materialCode).toBe(MATERIAL_CODES.carcass);
      expect(back?.thicknessIn).toBe(defaults.panelThickness);
    });

    it("left + right finishing panels are 3/4\" thick", () => {
      const result = computeVanityIngredients(baseInputs(), opts);
      const left = result.panels.find((p) => p.label === "Left finishing panel");
      const right = result.panels.find((p) => p.label === "Right finishing panel");
      expect(left?.thicknessIn).toBe(defaults.finishPanelThickness);
      expect(right?.thicknessIn).toBe(defaults.finishPanelThickness);
    });

    it("still produces door fronts + hinges + handles for a 2-door vanity", () => {
      const result = computeVanityIngredients(baseInputs({ doors: 2 }), opts);

      const doorPanels = result.panels.filter((p) => p.category === "door");
      expect(doorPanels.length).toBeGreaterThan(0);
      expect(doorPanels[0].qty).toBe(2);

      const hinges = result.hardware.filter((h) => h.category === "hinges");
      expect(hinges.reduce((sum, h) => sum + h.quantity, 0)).toBe(4);

      const handles = result.hardware.filter(
        (h) => h.materialCode === MATERIAL_CODES.handle
      );
      expect(handles.reduce((sum, h) => sum + h.quantity, 0)).toBe(2);
    });

    it("still emits drawer boxes + kits for drawer-over-doors", () => {
      const result = computeVanityIngredients(
        baseInputs({ drawers: 1, doors: 1 }),
        opts
      );

      const drawerPanels = result.panels.filter((p) => p.category === "drawer");
      expect(drawerPanels.length).toBeGreaterThan(0);

      const drawerLabels = drawerPanels.map((p) => p.label);
      expect(drawerLabels.some((l) => l.startsWith("Drawer front"))).toBe(true);
      expect(drawerLabels.some((l) => l.startsWith("Drawer box sides"))).toBe(true);
      expect(drawerLabels.some((l) => l.startsWith("Drawer box F/B"))).toBe(true);
      expect(drawerLabels.some((l) => l.startsWith("Drawer box bottom"))).toBe(true);

      const kits = result.hardware.filter((h) => h.category === "drawer_boxes");
      expect(kits.reduce((sum, h) => sum + h.quantity, 0)).toBe(1);
    });
  });

  describe("modular-box counts for 2 sections", () => {
    it("a 2-section vanity has 4 sides, 2 bottoms, 2 top-front, 2 top-back and 2 backs", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 1, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "all_drawers", width: 12, doors: 0, drawers: 2 },
      ];
      const result = computeVanityIngredients(baseInputs({ sections }), opts);

      const sidesQty = result.panels
        .filter((p) => p.label.startsWith("Sides ("))
        .reduce((sum, p) => sum + p.qty, 0);
      expect(sidesQty).toBe(4);

      const bottomsQty = result.panels
        .filter((p) => p.label.startsWith("Bottom ("))
        .reduce((sum, p) => sum + p.qty, 0);
      expect(bottomsQty).toBe(2);

      const topFrontQty = result.panels
        .filter((p) => p.label.startsWith("Top front stretcher ("))
        .reduce((sum, p) => sum + p.qty, 0);
      expect(topFrontQty).toBe(2);

      const topBackQty = result.panels
        .filter((p) => p.label.startsWith("Top back stretcher ("))
        .reduce((sum, p) => sum + p.qty, 0);
      expect(topBackQty).toBe(2);

      const backsQty = result.panels
        .filter((p) => p.label.startsWith("Back ("))
        .reduce((sum, p) => sum + p.qty, 0);
      expect(backsQty).toBe(2);

      // Still wrapped by two finishing panels.
      expect(
        result.panels.find((p) => p.label === "Left finishing panel")?.qty
      ).toBe(1);
      expect(
        result.panels.find((p) => p.label === "Right finishing panel")?.qty
      ).toBe(1);
    });

    it("per-section edge banding = 2*height + 2*depth + 2*sectionWidth, summed", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 1, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "doors", width: 10, doors: 1, drawers: 0 },
      ];
      const result = computeVanityIngredients(
        baseInputs({ sections, height: 30 }),
        opts
      );

      // 2*30 + 2*22 + 2*12  +  2*30 + 2*22 + 2*10 = 128 + 124 = 252
      expect(result.edgeBandingTotalIn).toBe(252);
    });
  });

  describe("framing styles", () => {
    it("adds bottom face frame for 'Sides and bottom'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Sides and bottom" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom face frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top face frame")).toBe(false);
    });

    it("adds bottom + top face frame for 'Around'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Around" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom face frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top face frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Side face frames")).toBe(false);
    });

    it("adds all face frames for 'Frame everything'", () => {
      const result = computeVanityIngredients(
        baseInputs({ framingStyle: "Frame everything" }),
        opts
      );
      expect(result.panels.some((p) => p.label === "Bottom face frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Top face frame")).toBe(true);
      expect(result.panels.some((p) => p.label === "Side face frames")).toBe(true);
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
      const left = result.panels.find((p) => p.label === "Left finishing panel");
      expect(left?.lengthIn).toBe(24);
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

  describe("U-shape drawer for top drawer under sink", () => {
    it("labels the top drawer as U-shape when the section hasSink", () => {
      const sections: VanitySection[] = [
        {
          id: "s1",
          sortOrder: 0,
          layoutType: "drawer_over_doors",
          width: 24,
          doors: 2,
          drawers: 1,
          hasSink: true,
        },
      ];
      const result = computeVanityIngredients(baseInputs({ sections }), opts);
      const labels = result.panels.map((p) => p.label);
      expect(labels.some((l) => l.includes("U-shape"))).toBe(true);
    });

    it("does not label as U-shape when hasSink is false", () => {
      const sections: VanitySection[] = [
        {
          id: "s1",
          sortOrder: 0,
          layoutType: "drawer_over_doors",
          width: 24,
          doors: 2,
          drawers: 1,
          hasSink: false,
        },
      ];
      const result = computeVanityIngredients(baseInputs({ sections }), opts);
      const labels = result.panels.map((p) => p.label);
      expect(labels.some((l) => l.includes("U-shape"))).toBe(false);
    });
  });

  describe("metrics", () => {
    it("dividerCount stays (sections-1) for continuity with old dashboards", () => {
      const sections: VanitySection[] = [
        { id: "s1", sortOrder: 0, layoutType: "doors", width: 12, doors: 2, drawers: 0 },
        { id: "s2", sortOrder: 1, layoutType: "all_drawers", width: 12, doors: 0, drawers: 2 },
      ];
      const result = computeVanityIngredients(baseInputs({ sections }), opts);

      expect(result.metrics.frontCount).toBe(4);
      expect(result.metrics.drawerCount).toBe(2);
      expect(result.metrics.dividerCount).toBe(1);
      expect(result.metrics.hingeCount).toBe(4);
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
      expect(
        result.sheetEstimates.some(
          (s) => s.materialCode === MATERIAL_CODES.carcass
        )
      ).toBe(true);
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
      const left = result.panels.find((p) => p.label === "Left finishing panel");
      expect(left?.lengthIn).toBe(36);
    });
  });
});
