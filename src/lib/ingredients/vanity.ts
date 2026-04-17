/**
 * Vanity ingredient engine — computes BOM (panels, hardware, edge banding,
 * sheets) from vanity configuration.
 *
 * Mental model (post-Phase-4 refactor):
 * -------------------------------------
 *  Overall vanity =  [Left finish panel 3/4"] + [modular box] + ... + [modular box] + [Right finish panel 3/4"]
 *
 *  A "section" is one modular carcass box. Each box contributes:
 *    - 2 sides              (length = height,       depth, 5/8")
 *    - 1 bottom             (length = sectionWidth - 2*T, depth, 5/8")
 *    - 1 top-front stretcher(length = sectionWidth - 2*T, stretcherDepth, 5/8")
 *    - 1 top-back stretcher (length = sectionWidth - 2*T, stretcherDepth, 5/8")
 *    - 1 back               (length = height, width = sectionWidth - 2*T, 5/8" melamine — same as carcass)
 *
 *  The total vanity width the customer ordered is:
 *      inputs.width = 2 * finishPanelThickness + Σ section.width
 *
 *  i.e. the sum of section.width values always equals inputs.width − 1.5"
 *  (assuming the standard 3/4" finish panels on each side). This is what is
 *  being drawn on the cutlist — it is intentionally more panels than a
 *  "shared divider" build, because each section is a standalone box.
 *
 *  Edge banding is computed PER section and summed, using the user-provided
 *  rule:
 *      perSection = 2 * height + 2 * depth + 2 * section.width
 *
 *  Legacy mode (no explicit sections) collapses to a single implicit
 *  section whose width equals inputs.width − 2 * finishPanelThickness, so
 *  the math stays consistent.
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

export function computeVanityIngredients(
  inputs: VanityIngredientInputs,
  options: VanityIngredientOptions
): IngredientEstimate {
  const s = options.standards;
  const panels: EstimatedPanel[] = [];
  const hardware: EstimatedHardware[] = [];

  // Resolve height from inputs or mounting style.
  const height =
    inputs.height ??
    (inputs.mountingStyle === "Wall-hung"
      ? s.wallHungHeight
      : s.defaultVanityHeight);

  // Carcass wall thickness (5/8" default, 3/4" for "thick frame" flag).
  const T = inputs.thickFrame ? s.thickFrameThickness : s.panelThickness;
  // Outer finishing panel thickness. Always added on both sides of the vanity.
  const FP = s.finishPanelThickness;

  const hasKickplate =
    inputs.kickplate && inputs.mountingStyle !== "Wall-hung";
  const kickH = hasKickplate ? s.kickplateHeight : 0;

  // Interior height (inside the box, below the top stretcher, above the bottom).
  const interiorHeight = height - kickH - T;

  // ─── Resolve sections (legacy fallback becomes 1 implicit section) ───

  // Amount of the outer vanity width consumed by the two finishing panels.
  const finishPanelsWidth = 2 * FP;

  const sections: VanitySection[] = inputs.sections?.length
    ? [...inputs.sections].sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: "__legacy__",
          sortOrder: 0,
          layoutType:
            inputs.drawers > 0 && inputs.doors > 0
              ? "drawer_over_doors"
              : inputs.drawers > 0
                ? "all_drawers"
                : inputs.doors > 0
                  ? "doors"
                  : "open",
          // Legacy: the single implicit section spans the vanity minus the
          // finishing panels, so the math matches the sectioned case.
          width: Math.max(1, inputs.width - finishPanelsWidth),
          doors: inputs.doors,
          drawers: inputs.drawers,
        },
      ];

  // ─── Outer finishing panels (always added) ───────────────────────────

  panels.push({
    label: "Left finishing panel",
    lengthIn: height,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: FP,
    category: "carcass",
    edgeBandedEdges: 1, // front face
  });

  panels.push({
    label: "Right finishing panel",
    lengthIn: height,
    widthIn: inputs.depth,
    qty: 1,
    materialCode: MATERIAL_CODES.carcass,
    thicknessIn: FP,
    category: "carcass",
    edgeBandedEdges: 1,
  });

  // ─── Optional outer framing panels (top/side/bottom face frames) ────

  const fs = inputs.framingStyle;
  if (fs === "Sides and bottom" || fs === "Around" || fs === "Frame everything") {
    panels.push({
      label: "Bottom face frame",
      lengthIn: inputs.width,
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
      label: "Top face frame",
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
      label: "Side face frames",
      lengthIn: height,
      widthIn: s.framingWidth,
      qty: 2,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "framing",
      edgeBandedEdges: 1,
    });
  }

  // ─── Kickplate (spans the full exterior width) ───────────────────────

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

  // ─── Per-section carcass boxes + fronts + hardware ───────────────────

  // Edge banding accumulator, per the user rule:
  //   per section = 2 * height + 2 * depth + 2 * section.width
  let edgeBandingTotalIn = 0;

  let totalDoors = 0;
  let totalDrawers = 0;
  let totalFronts = 0;

  for (const section of sections) {
    const sectionWidth = section.width;
    const interiorWidth = Math.max(0, sectionWidth - 2 * T);

    // Modular carcass: 2 sides (5/8").
    panels.push({
      label: `Sides (${section.id})`,
      lengthIn: height,
      widthIn: inputs.depth,
      qty: 2,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "carcass",
      edgeBandedEdges: 1, // front edge of each side
      sectionId: section.id,
    });

    // Bottom.
    panels.push({
      label: `Bottom (${section.id})`,
      lengthIn: interiorWidth,
      widthIn: inputs.depth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "carcass",
      edgeBandedEdges: 1,
      sectionId: section.id,
    });

    // Top stretchers — front and back. Front gets a banded edge.
    panels.push({
      label: `Top front stretcher (${section.id})`,
      lengthIn: interiorWidth,
      widthIn: s.stretcherDepth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "stretcher",
      edgeBandedEdges: 1,
      sectionId: section.id,
    });
    panels.push({
      label: `Top back stretcher (${section.id})`,
      lengthIn: interiorWidth,
      widthIn: s.stretcherDepth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "stretcher",
      edgeBandedEdges: 0,
      sectionId: section.id,
    });

    // Back panel — 5/8" melamine (carcass material), NOT 1/4" hardboard.
    // This is an explicit rule update: back panels are structural.
    panels.push({
      label: `Back (${section.id})`,
      lengthIn: height,
      widthIn: interiorWidth,
      qty: 1,
      materialCode: MATERIAL_CODES.carcass,
      thicknessIn: T,
      category: "carcass",
      edgeBandedEdges: 0,
      sectionId: section.id,
    });

    // Edge banding contribution for this section. Literal user rule:
    //   2*height (sides) + 2*depth (top stretcher + bottom) + 2*section.width.
    edgeBandingTotalIn +=
      2 * height + 2 * inputs.depth + 2 * sectionWidth;

    // ─── Door / drawer fronts & hardware ─────────────────────────────

    const doorCount = section.doors;
    const drawerCount = section.drawers;

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

    if (doorCount > 0 && doorHeight > 0) {
      const doorWidth =
        (sectionWidth - (doorCount - 1) * s.doorGap) / doorCount;
      panels.push({
        label: `Door front (${section.id})`,
        lengthIn: doorHeight,
        widthIn: doorWidth,
        qty: doorCount,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "door",
        edgeBandedEdges: 4,
        sectionId: section.id,
      });

      const hingesPerDoor = doorHeight >= 36 ? 3 : 2;
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

      totalDoors += doorCount;
      totalFronts += doorCount;
    }

    if (drawerCount > 0) {
      const drawerFrontWidth = sectionWidth;

      // When the top drawer sits above a sink, the drawer BOX is built
      // U-shaped so it clears the sink plumbing. We don't change the
      // billed material yet (same rectangle is sourced for the cut), but
      // we record the intent on the panel so the cutlist/shop sees it.
      const topDrawerIsUShaped =
        section.hasSink === true &&
        (section.layoutType === "drawer_over_doors" ||
          section.layoutType === "all_drawers");

      panels.push({
        label:
          topDrawerIsUShaped && drawerCount === 1
            ? `Drawer front (U-shape, ${section.id})`
            : `Drawer front (${section.id})`,
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
      panels.push({
        label: topDrawerIsUShaped
          ? `Drawer box sides — top is U-shape (${section.id})`
          : `Drawer box sides (${section.id})`,
        lengthIn: boxDepth,
        widthIn: s.drawerBoxHeight,
        qty: drawerCount * 2,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "drawer",
        edgeBandedEdges: 0,
        sectionId: section.id,
      });

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

      // Drawer box bottoms are cut from the same 5/8" melamine as the
      // rest of the carcass. The shop confirmed (2026-04-16) that no
      // 1/4" material is used in vanity builds today — every panel the
      // engine emits must come off a 5/8" sheet so the sheet-count
      // estimator stays honest.
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

      // A U-shape drawer adds extra edge banding to cover the interior
      // cutout edges. Rough approximation: 2 × boxDepth + drawerFrontWidth.
      if (topDrawerIsUShaped) {
        edgeBandingTotalIn += 2 * boxDepth + drawerFrontWidth;
      }

      totalDrawers += drawerCount;
      totalFronts += drawerCount;
    }

    if (
      section.layoutType === "doors" ||
      section.layoutType === "drawer_over_doors" ||
      section.layoutType === "doors_over_drawer"
    ) {
      panels.push({
        label: `Shelf (${section.id})`,
        lengthIn: interiorWidth,
        widthIn: inputs.depth - s.shelfSetback,
        qty: 1,
        materialCode: MATERIAL_CODES.carcass,
        thicknessIn: T,
        category: "shelf",
        edgeBandedEdges: 1,
        sectionId: section.id,
      });
    }

    if (section.layoutType === "open") {
      const shelfCount = Math.max(1, Math.floor(interiorHeight / 16));
      panels.push({
        label: `Open shelves (${section.id})`,
        lengthIn: interiorWidth,
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

  // "Divider count" retained for metric continuity (n sections => n-1
  // shared walls). It no longer corresponds to a standalone panel in the
  // modular-box model, but downstream dashboards expect a number.
  const dividerCount = Math.max(0, sections.length - 1);

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
