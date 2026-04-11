/**
 * Soft configuration warnings — flags configurations that are technically valid
 * but operationally questionable. Non-blocking; shown in UI as advisory messages.
 */

import type {
  ConfigWarning,
  ConstructionStandardsData,
  VanitySection,
  SideUnitSection,
} from "./types";

type CommonInputs = {
  width: number;
  depth: number;
  height?: number | null;
  mountingStyle: string;
  kickplate: boolean;
  sections?: (VanitySection | SideUnitSection)[] | null;
  numberOfSinks?: string;
  sinks?: string | null;
  doors?: number;
  drawers?: number;
};

/**
 * Compute soft warnings for a vanity or side unit configuration.
 * These are non-blocking advisories, not validation errors.
 */
export function computeConfigWarnings(
  inputs: CommonInputs,
  standards: ConstructionStandardsData
): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const sections = inputs.sections ?? [];

  // ─── Global warnings ───────────────────────────────────────────────

  // Wide wall-mounted vanity
  if (inputs.mountingStyle === "Wall-hung" && inputs.width > 48) {
    warnings.push({
      code: "WIDE_WALL_MOUNT",
      severity: "warning",
      message: `Wall-mounted cabinet at ${inputs.width}" wide — verify mounting support is adequate.`,
    });
  }

  // Very deep cabinet
  if (inputs.depth > 30) {
    warnings.push({
      code: "DEEP_CABINET",
      severity: "info",
      message: `Cabinet depth ${inputs.depth}" exceeds standard ${standards.standardBaseDepth}". Verify material and access requirements.`,
    });
  }

  // ─── Sink-related warnings ─────────────────────────────────────────

  // Check if any section is all-drawers with a sink present
  const hasSink =
    inputs.numberOfSinks === "Double" ||
    inputs.numberOfSinks === "Single" ||
    (inputs.sinks && inputs.sinks !== "None");

  if (hasSink && sections.length > 0) {
    for (const section of sections) {
      if ("layoutType" in section && section.layoutType === "all_drawers") {
        warnings.push({
          code: "SINK_WITH_ALL_DRAWERS",
          severity: "warning",
          message: `All-drawer section "${section.id}" may conflict with plumbing. Consider a doors or mixed layout for the sink area.`,
          sectionId: section.id,
        });
      }
    }
  }

  // ─── Per-section warnings ──────────────────────────────────────────

  for (const section of sections) {
    // Narrow section with doors
    if ("width" in section) {
      const vanitySection = section as VanitySection;
      if (
        vanitySection.width < 12 &&
        vanitySection.layoutType !== "open" &&
        vanitySection.doors > 0
      ) {
        warnings.push({
          code: "NARROW_SECTION_DOORS",
          severity: "warning",
          message: `Section "${section.id}" is only ${vanitySection.width}" wide with doors — may cause alignment issues.`,
          sectionId: section.id,
        });
      }

      // Many doors in narrow section
      if (vanitySection.doors > 2 && vanitySection.width < 24) {
        warnings.push({
          code: "TOO_MANY_DOORS_NARROW",
          severity: "warning",
          message: `${vanitySection.doors} doors in ${vanitySection.width}" section — door widths will be very narrow.`,
          sectionId: section.id,
        });
      }
    }

    // Short section with doors (side unit)
    if ("height" in section) {
      const sideSection = section as SideUnitSection;
      if (
        sideSection.height < 8 &&
        sideSection.layoutType === "doors"
      ) {
        warnings.push({
          code: "SHORT_SECTION_DOORS",
          severity: "info",
          message: `Section "${section.id}" at ${sideSection.height}" tall with doors — may look disproportionate.`,
          sectionId: section.id,
        });
      }
    }
  }

  // ─── Unbalanced layout warning ─────────────────────────────────────

  if (sections.length >= 2) {
    const widths = sections
      .filter((sec): sec is VanitySection => "width" in sec)
      .map((sec) => sec.width);

    if (widths.length >= 2) {
      const maxW = Math.max(...widths);
      const minW = Math.min(...widths);
      if (maxW > minW * 3) {
        warnings.push({
          code: "UNBALANCED_SECTIONS",
          severity: "info",
          message: `Section widths vary significantly (${minW}" to ${maxW}"). Consider redistributing for a more balanced appearance.`,
        });
      }
    }
  }

  return warnings;
}
