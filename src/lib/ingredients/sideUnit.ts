/**
 * Side unit ingredient engine — computes BOM (panels, hardware, edge banding, sheets)
 * from side unit configuration including vertical section-based layout.
 *
 * Side units differ from vanities:
 * - Sections are vertical (bottom-to-top) instead of horizontal (left-to-right)
 * - Section dividers are horizontal shelves between stacked compartments
 * - Has a top panel (fully enclosed, unlike vanities which are open-top)
 * - Height is explicit from SideUnitInputs
 */

import type { SideUnitInputs } from "@/lib/pricing/sideUnit";
import type {
  SideUnitSection,
  EstimatedPanel,
  EstimatedHardware,
  IngredientEstimate,
  EstimateMetrics,
  ConstructionStandardsData,
} from "./types";
import { MATERIAL_CODES } from "./types";
import { computeSheetEstimates, type SheetFormat } from "./sheetEstimate";

export type SideUnitIngredientInputs = SideUnitInputs & {
  sections?: SideUnitSection[] | null;
};

export type SideUnitIngredientOptions = {
  standards: ConstructionStandardsData;
  sheetFormat?: SheetFormat;
  wasteFactor?: number;
};

/**
 * Compute the full ingredient estimate for a side unit configuration.
 * Section-aware: if sections provided, generates per-section panels vertically.
 * Legacy mode (no sections): treats flat doors/drawers as a single implicit section.
 */
export function computeSideUnitIngredients(
  inputs: SideUnitIngredientInputs,
  options: SideUnitIngredientOptions
): IngredientEstimate {
  const s = options.standards;
  const panels: EstimatedPanel[] = [];
  const hardware: EstimatedHardware[] = [];

  const height = inputs.height;
  const T = inputs.thickFrame ? s.thickFrameThickness : s.panelThickness;
  const hasKickplate =
    inputs.kickplate && inputs.mountingStyle !== "Wall-hung";
  const kickH = hasKickplate ? s.kickplateHeight : 0;
  const interiorHeight = height - kickH - 2 * T; // minus top and bottom panel thickness

  // Resolve sections — legacy mode creates a single implicit section
  const sections: SideUnitSection[] = inputs.sections?.length
    ? [...inputs.sections].sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: "__legacy__",
          sortOrder: 0,
          layoutType: inputs.drawers > 0
            ? "drawers"
            : inputs.doors > 0
              ? "doors"
              : "open",
          height: interiorHeight,
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
    edgeBandedEdges: 1,
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
    edgeBandedEdges: 1,
  });

  // Top (side units are fully enclosed)
  panels.push({
    label: "Top",
    lengthIn: inputs.width - 2 * T,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "carcass",
    edgeBandedEdges: 1,
  });

  // Back panel — 5/8" melamine, same rule that governs vanity section
  // backs (shop standard: everything structural is 5/8").
  panels.push({
    label: "Back panel",
    lengthIn: height,
    widthIn: inputs.width - 2 * T,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: T,
    category: "carcass",
    edgeBandedEdges: 0,
  });

  // Top stretcher (structural reinforcement)
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

  if (inputs.mountingStyle === "Wall-hung") {
    hardware.push({
      materialCode: MATERIAL_CODES.hangingRail,
      category: "other",
      quantity: 1,
      label: "Hanging rail",
    });
  }

  // ─── Section dividers (horizontal shelves between vertical compartments) ──

  const dividerCount = Math.max(0, sections.length - 1);
  if (dividerCount > 0) {
    panels.push({
      label: "Section dividers",
      lengthIn: inputs.width - 2 * T,
      widthIn: inputs.depth,
      qty: dividerCount,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "divider",
      edgeBandedEdges: 1,
    });
  }

  // ─── Per-section panels and hardware ────────────────────────────────

  let totalDoors = 0;
  let totalDrawers = 0;
  let totalFronts = 0;

  for (const section of sections) {
    const sectionHeight = section.height;
    const doorCount = section.doors;
    const drawerCount = section.drawers;

    // For side units, doors span the section width; height is the section height
    if (section.layoutType === "doors" && doorCount > 0) {
      const doorWidth =
        (inputs.width - 2 * T - (doorCount - 1) * s.doorGap) / doorCount;
      panels.push({
        label: `Door front (${section.id})`,
        lengthIn: sectionHeight,
        widthIn: doorWidth,
        qty: doorCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "door",
        edgeBandedEdges: 4,
        sectionId: section.id,
      });

      const hingesPerDoor = sectionHeight >= 36 ? 3 : 2;
      hardware.push({
        materialCode: MATERIAL_CODES.hinge,
        category: "hinges",
        quantity: doorCount * hingesPerDoor,
        label: `Hinges (${section.id})`,
      });

      hardware.push({
        materialCode: MATERIAL_CODES.handle,
        category: "other",
        quantity: doorCount,
        label: `Door handles (${section.id})`,
      });

      // Shelf inside door section
      panels.push({
        label: `Shelf (${section.id})`,
        lengthIn: inputs.width - 2 * T,
        widthIn: inputs.depth - s.shelfSetback,
        qty: 1,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "shelf",
        edgeBandedEdges: 1,
        sectionId: section.id,
      });

      totalDoors += doorCount;
      totalFronts += doorCount;
    }

    // Drawers — stacked in this section
    if (section.layoutType === "drawers" && drawerCount > 0) {
      const drawerFrontH = sectionHeight / drawerCount;
      const drawerFrontWidth = inputs.width - 2 * T;

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

      const boxDepth = inputs.depth - 2;
      const boxWidth = drawerFrontWidth - 2 * T;

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

      // Drawer box bottoms cut from 5/8" melamine — shop no longer
      // stocks 1/4" hardboard for cabinetry.
      panels.push({
        label: `Drawer box bottom (${section.id})`,
        lengthIn: boxWidth,
        widthIn: boxDepth,
        qty: drawerCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "drawer",
        edgeBandedEdges: 0,
        sectionId: section.id,
      });

      hardware.push({
        materialCode: MATERIAL_CODES.drawerKit,
        category: "drawer_boxes",
        quantity: drawerCount,
        label: `Drawer kits (${section.id})`,
      });

      hardware.push({
        materialCode: MATERIAL_CODES.handle,
        category: "other",
        quantity: drawerCount,
        label: `Drawer handles (${section.id})`,
      });

      totalDrawers += drawerCount;
      totalFronts += drawerCount;
    }

    // Open sections — shelves only
    if (section.layoutType === "open") {
      const shelfCount = Math.max(1, Math.floor(sectionHeight / 16));
      panels.push({
        label: `Open shelves (${section.id})`,
        lengthIn: inputs.width - 2 * T,
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
