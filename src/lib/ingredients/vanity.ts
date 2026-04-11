/**
 * Vanity ingredient engine — computes BOM (panels, hardware, edge banding, sheets)
 * from vanity configuration including section-based layout.
 *
 * This is the "live estimate" layer. It answers: "what materials are needed?"
 * The saved snapshot (MaterialSnapshot) persists a specific computation result.
 */

import type { VanityInputs } from "@/lib/pricing/vanity";
import type {
  VanitySection,
  EstimatedPanel,
  EstimatedHardware,
  IngredientEstimate,
  EstimateMetrics,
  ConstructionStandardsData,
} from "./types";
import { MATERIAL_CODES } from "./types";
import { computeSheetEstimates, type SheetFormat } from "./sheetEstimate";

export type VanityIngredientInputs = VanityInputs & {
  height?: number | null;
  sections?: VanitySection[] | null;
};

export type VanityIngredientOptions = {
  standards: ConstructionStandardsData;
  sheetFormat?: SheetFormat;
  wasteFactor?: number;
};

/**
 * Compute the full ingredient estimate for a vanity configuration.
 * Section-aware: if sections provided, generates per-section panels.
 * Legacy mode (no sections): treats flat doors/drawers as a single implicit section.
 */
export function computeVanityIngredients(
  inputs: VanityIngredientInputs,
  options: VanityIngredientOptions
): IngredientEstimate {
  const s = options.standards;
  const panels: EstimatedPanel[] = [];
  const hardware: EstimatedHardware[] = [];

  // Resolve height from inputs or mounting style
  const height =
    inputs.height ??
    (inputs.mountingStyle === "Wall-hung"
      ? s.wallHungHeight
      : s.defaultVanityHeight);
  const T = inputs.thickFrame ? s.thickFrameThickness : s.panelThickness;
  const hasKickplate =
    inputs.kickplate && inputs.mountingStyle !== "Wall-hung";
  const kickH = hasKickplate ? s.kickplateHeight : 0;
  const interiorHeight = height - kickH - T; // minus bottom panel thickness at stretcher

  // Resolve sections — legacy mode creates a single implicit section
  const sections: VanitySection[] = inputs.sections?.length
    ? [...inputs.sections].sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: "__legacy__",
          sortOrder: 0,
          layoutType: inputs.drawers > 0 && inputs.doors > 0
            ? "drawer_over_doors"
            : inputs.drawers > 0
              ? "all_drawers"
              : inputs.doors > 0
                ? "doors"
                : "open",
          width: inputs.width,
          doors: inputs.doors,
          drawers: inputs.drawers,
        },
      ];

  // ─── Shared carcass panels ───────────────────────────────────────────

  // Left side
  panels.push({
    label: "Left side",
    lengthIn: height,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "carcass",
    edgeBandedEdges: 1, // front edge
  });

  // Right side
  panels.push({
    label: "Right side",
    lengthIn: height,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "carcass",
    edgeBandedEdges: 1,
  });

  // Bottom
  panels.push({
    label: "Bottom",
    lengthIn: inputs.width - 2 * T,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "carcass",
    edgeBandedEdges: 1, // front edge
  });

  // Back panel (thin material)
  panels.push({
    label: "Back panel",
    lengthIn: height,
    widthIn: inputs.width - 2 * T,
    qty: 1,
    materialCode: MATERIAL_CODES.back,
    thicknessIn: s.backThickness,
    category: "carcass",
    edgeBandedEdges: 0,
  });

  // Top stretcher
  panels.push({
    label: "Top stretcher",
    lengthIn: inputs.width,
    widthIn: s.stretcherDepth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "stretcher",
    edgeBandedEdges: 1,
  });

  // ─── Framing panels ─────────────────────────────────────────────────

  const fs = inputs.framingStyle;
  if (fs === "Sides and bottom" || fs === "Around" || fs === "Frame everything") {
    panels.push({
      label: "Bottom frame",
      lengthIn: inputs.width - 2 * T,
      widthIn: s.framingWidth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "framing",
      edgeBandedEdges: 1,
    });
  }
  if (fs === "Around" || fs === "Frame everything") {
    panels.push({
      label: "Top frame",
      lengthIn: inputs.width,
      widthIn: s.framingWidth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "framing",
      edgeBandedEdges: 1,
    });
  }
  if (fs === "Frame everything") {
    panels.push({
      label: "Side frames",
      lengthIn: height,
      widthIn: s.framingWidth,
      qty: 2,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "framing",
      edgeBandedEdges: 1,
    });
  }

  // ─── Kickplate ──────────────────────────────────────────────────────

  if (hasKickplate) {
    panels.push({
      label: "Kickplate",
      lengthIn: inputs.width,
      widthIn: s.kickplateHeight,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "kickplate",
      edgeBandedEdges: 0,
    });
  }

  // Box base: 4 additional panels forming a base box
  if (inputs.mountingStyle === "Box base") {
    panels.push(
      {
        label: "Box base front",
        lengthIn: inputs.width,
        widthIn: s.kickplateHeight,
        qty: 1,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "kickplate",
        edgeBandedEdges: 0,
      },
      {
        label: "Box base back",
        lengthIn: inputs.width,
        widthIn: s.kickplateHeight,
        qty: 1,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "kickplate",
        edgeBandedEdges: 0,
      },
      {
        label: "Box base sides",
        lengthIn: inputs.depth,
        widthIn: s.kickplateHeight,
        qty: 2,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "kickplate",
        edgeBandedEdges: 0,
      }
    );
  }

  // Wall-hung: hanging rail hardware
  if (inputs.mountingStyle === "Wall-hung") {
    hardware.push({
      materialCode: MATERIAL_CODES.hangingRail,
      category: "other",
      quantity: 1,
      label: "Hanging rail",
    });
  }

  // ─── Section dividers ───────────────────────────────────────────────

  const dividerCount = Math.max(0, sections.length - 1);
  if (dividerCount > 0) {
    panels.push({
      label: "Section dividers",
      lengthIn: interiorHeight,
      widthIn: inputs.depth,
      qty: dividerCount,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "divider",
      edgeBandedEdges: 1, // front edge
    });
  }

  // ─── Per-section panels and hardware ────────────────────────────────

  let totalDoors = 0;
  let totalDrawers = 0;
  let totalFronts = 0;

  for (const section of sections) {
    const sectionWidth = section.width - (section.id === "__legacy__" ? 0 : 0);
    // Door/drawer front dimensions based on layout type
    const doorCount = section.doors;
    const drawerCount = section.drawers;

    // Calculate door and drawer heights based on layout
    let doorHeight: number;
    let drawerFrontH = s.drawerFrontHeight;

    switch (section.layoutType) {
      case "doors":
        doorHeight = interiorHeight;
        break;
      case "drawer_over_doors":
        doorHeight = interiorHeight - drawerCount * drawerFrontH;
        break;
      case "doors_over_drawer":
        doorHeight = interiorHeight - drawerCount * drawerFrontH;
        break;
      case "all_drawers":
        doorHeight = 0;
        // Evenly distribute drawer heights
        if (drawerCount > 0) {
          drawerFrontH = interiorHeight / drawerCount;
        }
        break;
      case "open":
        doorHeight = 0;
        break;
      default:
        doorHeight = interiorHeight;
    }

    // Door fronts
    if (doorCount > 0 && doorHeight > 0) {
      const doorWidth = (sectionWidth - (doorCount - 1) * s.doorGap) / doorCount;
      panels.push({
        label: `Door front (${section.id})`,
        lengthIn: doorHeight,
        widthIn: doorWidth,
        qty: doorCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "door",
        edgeBandedEdges: 4, // all edges for slab/shaker
        sectionId: section.id,
      });

      // Hinges: 2 per door if < 36" tall, 3 if >= 36"
      const hingesPerDoor = doorHeight >= 36 ? 3 : 2;
      hardware.push({
        materialCode: MATERIAL_CODES.hinge,
        category: "hinges",
        quantity: doorCount * hingesPerDoor,
        label: `Hinges (${section.id})`,
      });

      // Door handles
      hardware.push({
        materialCode: MATERIAL_CODES.handle,
        category: "other",
        quantity: doorCount,
        label: `Door handles (${section.id})`,
      });

      totalDoors += doorCount;
      totalFronts += doorCount;
    }

    // Drawer fronts + boxes
    if (drawerCount > 0) {
      const drawerFrontWidth = sectionWidth;
      panels.push({
        label: `Drawer front (${section.id})`,
        lengthIn: drawerFrontH,
        widthIn: drawerFrontWidth,
        qty: drawerCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "drawer",
        edgeBandedEdges: 4,
        sectionId: section.id,
      });

      // Drawer box sides (2 per drawer)
      const boxDepth = inputs.depth - 2;
      panels.push({
        label: `Drawer box sides (${section.id})`,
        lengthIn: boxDepth,
        widthIn: s.drawerBoxHeight,
        qty: drawerCount * 2,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "drawer",
        edgeBandedEdges: 0,
        sectionId: section.id,
      });

      // Drawer box front/back (2 per drawer)
      const boxWidth = drawerFrontWidth - 2 * T;
      panels.push({
        label: `Drawer box F/B (${section.id})`,
        lengthIn: boxWidth,
        widthIn: s.drawerBoxHeight,
        qty: drawerCount * 2,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "drawer",
        edgeBandedEdges: 0,
        sectionId: section.id,
      });

      // Drawer box bottom (1/4" material)
      panels.push({
        label: `Drawer box bottom (${section.id})`,
        lengthIn: boxWidth,
        widthIn: boxDepth,
        qty: drawerCount,
        materialCode: MATERIAL_CODES.back,
        thicknessIn: s.backThickness,
        category: "drawer",
        edgeBandedEdges: 0,
        sectionId: section.id,
      });

      // Drawer kits
      hardware.push({
        materialCode: MATERIAL_CODES.drawerKit,
        category: "drawer_boxes",
        quantity: drawerCount,
        label: `Drawer kits (${section.id})`,
      });

      // Drawer handles
      hardware.push({
        materialCode: MATERIAL_CODES.handle,
        category: "other",
        quantity: drawerCount,
        label: `Drawer handles (${section.id})`,
      });

      totalDrawers += drawerCount;
      totalFronts += drawerCount;
    }

    // Shelf for door sections (1 per door section)
    if (
      section.layoutType === "doors" ||
      section.layoutType === "drawer_over_doors" ||
      section.layoutType === "doors_over_drawer"
    ) {
      panels.push({
        label: `Shelf (${section.id})`,
        lengthIn: sectionWidth - 2 * T,
        widthIn: inputs.depth - s.shelfSetback,
        qty: 1,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "shelf",
        edgeBandedEdges: 1, // front edge
        sectionId: section.id,
      });
    }

    // Open sections get extra shelves
    if (section.layoutType === "open") {
      const shelfCount = Math.max(1, Math.floor(interiorHeight / 16));
      panels.push({
        label: `Open shelves (${section.id})`,
        lengthIn: sectionWidth - 2 * T,
        widthIn: inputs.depth - s.shelfSetback,
        qty: shelfCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "shelf",
        edgeBandedEdges: 1,
        sectionId: section.id,
      });
    }
  }

  // ─── Edge banding total ─────────────────────────────────────────────

  let edgeBandingTotalIn = 0;
  for (const panel of panels) {
    if (panel.edgeBandedEdges > 0) {
      // Approximate: average of length and width per edge
      const perimeter = 2 * (panel.lengthIn + panel.widthIn);
      const edgesRatio = panel.edgeBandedEdges / 4;
      edgeBandingTotalIn += perimeter * edgesRatio * panel.qty;
    }
  }

  // ─── Sheet estimates ────────────────────────────────────────────────

  const sheetEstimates = computeSheetEstimates(
    panels,
    options.sheetFormat,
    options.wasteFactor
  );

  // ─── Metrics ────────────────────────────────────────────────────────

  const totalHinges = hardware
    .filter((h) => h.category === "hinges")
    .reduce((sum, h) => sum + h.quantity, 0);

  const totalPanelCount = panels.reduce((sum, p) => sum + p.qty, 0);
  const totalHardwareItems = hardware.reduce((sum, h) => sum + h.quantity, 0);

  const complexityScore =
    sections.length * 1 +
    totalDrawers * 1.5 +
    totalDoors * 1 +
    dividerCount * 0.5 +
    (inputs.thickFrame ? 2 : 0);

  const metrics: EstimateMetrics = {
    frontCount: totalFronts,
    drawerCount: totalDrawers,
    hingeCount: totalHinges,
    dividerCount,
    panelCount: totalPanelCount,
    complexityScore,
  };

  return {
    panels,
    hardware,
    edgeBandingTotalIn: Math.round(edgeBandingTotalIn * 10) / 10,
    sheetEstimates,
    totalPanelCount,
    totalHardwareItems,
    metrics,
  };
}
