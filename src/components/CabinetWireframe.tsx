"use client";

import type { VanitySection, SideUnitSection } from "@/lib/ingredients/types";

type Props = {
  direction: "horizontal" | "vertical";
  sections: (VanitySection | SideUnitSection)[];
  totalWidth: number;
  totalHeight: number;
  kickplate: boolean;
  kickplateHeight?: number;
};

const PADDING = 24;
const LABEL_SIZE = 12;
const HANDLE_SIZE = 4;

/**
 * SVG front-facing wireframe outline of a vanity or side unit.
 * Renders the carcass outline, section dividers, door/drawer outlines,
 * handles, kickplate, and dimension labels.
 */
export function CabinetWireframe({
  direction,
  sections,
  totalWidth,
  totalHeight,
  kickplate,
  kickplateHeight = 4,
}: Props) {
  const isHorizontal = direction === "horizontal";

  // SVG viewport — proportional scaling with padding
  const aspect = totalWidth / totalHeight;
  const svgW = 320;
  const svgH = svgW / aspect;
  const drawW = svgW - PADDING * 2;
  const drawH = svgH - PADDING * 2;
  const scaleX = drawW / totalWidth;
  const scaleY = drawH / totalHeight;
  const ox = PADDING; // origin X
  const oy = PADDING; // origin Y
  const kickH = kickplate ? kickplateHeight * scaleY : 0;

  // Sorted sections
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH + 16}`}
      className="w-full max-w-sm"
      style={{ maxHeight: 280 }}
    >
      {/* Outer carcass */}
      <rect
        x={ox}
        y={oy}
        width={drawW}
        height={drawH}
        fill="none"
        stroke="#374151"
        strokeWidth={1.5}
      />

      {/* Kickplate band */}
      {kickplate && (
        <rect
          x={ox}
          y={oy + drawH - kickH}
          width={drawW}
          height={kickH}
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth={0.5}
        />
      )}

      {/* Section rendering */}
      {isHorizontal
        ? renderHorizontalSections(sorted as VanitySection[], ox, oy, drawW, drawH, kickH, scaleX, scaleY, totalWidth)
        : renderVerticalSections(sorted as SideUnitSection[], ox, oy, drawW, drawH, kickH, scaleX, scaleY, totalHeight)}

      {/* Dimension labels */}
      <text x={ox + drawW / 2} y={svgH + 8} textAnchor="middle" fontSize={LABEL_SIZE} fill="#6b7280">
        {totalWidth}&quot;
      </text>
      <text
        x={8}
        y={oy + drawH / 2}
        textAnchor="middle"
        fontSize={LABEL_SIZE}
        fill="#6b7280"
        transform={`rotate(-90, 8, ${oy + drawH / 2})`}
      >
        {totalHeight}&quot;
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal sections (vanity — left to right)
// ---------------------------------------------------------------------------

function renderHorizontalSections(
  sections: VanitySection[],
  ox: number,
  oy: number,
  drawW: number,
  drawH: number,
  kickH: number,
  scaleX: number,
  scaleY: number,
  totalWidth: number
) {
  const elements: React.ReactNode[] = [];
  let xCursor = ox;
  const interiorH = drawH - kickH;
  const totalSectionW = sections.reduce((s, sec) => s + sec.width, 0);

  sections.forEach((section, i) => {
    const pctW = totalSectionW > 0 ? section.width / totalSectionW : 1 / sections.length;
    const sectionW = drawW * pctW;

    // Section divider (vertical line)
    if (i > 0) {
      elements.push(
        <line
          key={`div-${i}`}
          x1={xCursor}
          y1={oy}
          x2={xCursor}
          y2={oy + drawH - kickH}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      );
    }

    // Section content
    const contentY = oy;
    renderSectionContent(
      elements,
      section,
      xCursor,
      contentY,
      sectionW,
      interiorH,
      "horizontal",
      scaleX,
      scaleY
    );

    // Section width label
    elements.push(
      <text
        key={`lbl-${i}`}
        x={xCursor + sectionW / 2}
        y={oy - 4}
        textAnchor="middle"
        fontSize={9}
        fill="#9ca3af"
      >
        {section.width}&quot;
      </text>
    );

    xCursor += sectionW;
  });

  return elements;
}

// ---------------------------------------------------------------------------
// Vertical sections (side unit — bottom to top)
// ---------------------------------------------------------------------------

function renderVerticalSections(
  sections: SideUnitSection[],
  ox: number,
  oy: number,
  drawW: number,
  drawH: number,
  kickH: number,
  scaleX: number,
  scaleY: number,
  totalHeight: number
) {
  const elements: React.ReactNode[] = [];
  const totalSectionH = sections.reduce((s, sec) => s + sec.height, 0);
  // Render bottom-to-top: start from bottom
  let yCursor = oy + drawH - kickH;

  sections.forEach((section, i) => {
    const pctH = totalSectionH > 0 ? section.height / totalSectionH : 1 / sections.length;
    const sectionH = (drawH - kickH) * pctH;
    const sectionY = yCursor - sectionH;

    // Section divider (horizontal line)
    if (i > 0) {
      elements.push(
        <line
          key={`div-${i}`}
          x1={ox}
          y1={yCursor}
          x2={ox + drawW}
          y2={yCursor}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      );
    }

    renderSectionContent(
      elements,
      section,
      ox,
      sectionY,
      drawW,
      sectionH,
      "vertical",
      scaleX,
      scaleY
    );

    // Section height label
    elements.push(
      <text
        key={`lbl-${i}`}
        x={ox + drawW + 4}
        y={sectionY + sectionH / 2 + 3}
        fontSize={9}
        fill="#9ca3af"
      >
        {section.height}&quot;
      </text>
    );

    yCursor -= sectionH;
  });

  return elements;
}

// ---------------------------------------------------------------------------
// Section content renderer (doors, drawers, open)
// ---------------------------------------------------------------------------

function renderSectionContent(
  elements: React.ReactNode[],
  section: VanitySection | SideUnitSection,
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: "horizontal" | "vertical",
  _scaleX: number,
  _scaleY: number
) {
  const gap = 2;
  const inset = 3;
  const id = section.id;

  const layoutType = section.layoutType;
  const doors = section.doors;
  const drawers = section.drawers;

  // Determine door and drawer heights based on layout
  if (layoutType === "doors" || layoutType === "drawer_over_doors" || layoutType === "doors_over_drawer") {
    const drawerH = drawers > 0 ? Math.min(h * 0.3, (h / (doors + drawers)) * drawers) : 0;
    const doorH = h - drawerH;

    const drawerY = layoutType === "drawer_over_doors" ? y : y + doorH;
    const doorY = layoutType === "drawer_over_doors" ? y + drawerH : y;

    // Draw doors
    if (doors > 0) {
      const doorW = (w - inset * 2 - (doors - 1) * gap) / doors;
      for (let d = 0; d < doors; d++) {
        const dx = x + inset + d * (doorW + gap);
        elements.push(
          <rect
            key={`door-${id}-${d}`}
            x={dx}
            y={doorY + inset}
            width={doorW}
            height={doorH - inset * 2}
            fill="none"
            stroke="#6b7280"
            strokeWidth={0.75}
            rx={1}
          />
        );
        // Handle dot
        elements.push(
          <circle
            key={`handle-door-${id}-${d}`}
            cx={dx + doorW - 6}
            cy={doorY + doorH / 2}
            r={HANDLE_SIZE / 2}
            fill="#9ca3af"
          />
        );
      }
    }

    // Draw drawers
    if (drawers > 0) {
      const singleH = (drawerH - inset * 2 - (drawers - 1) * gap) / drawers;
      for (let d = 0; d < drawers; d++) {
        const dy = drawerY + inset + d * (singleH + gap);
        elements.push(
          <rect
            key={`drawer-${id}-${d}`}
            x={x + inset}
            y={dy}
            width={w - inset * 2}
            height={singleH}
            fill="none"
            stroke="#6b7280"
            strokeWidth={0.75}
            rx={1}
          />
        );
        // Handle line
        elements.push(
          <line
            key={`handle-drawer-${id}-${d}`}
            x1={x + w / 2 - 8}
            y1={dy + singleH / 2}
            x2={x + w / 2 + 8}
            y2={dy + singleH / 2}
            stroke="#9ca3af"
            strokeWidth={1}
          />
        );
      }
    }
  } else if (layoutType === "all_drawers" || layoutType === "drawers") {
    const count = drawers || 1;
    const singleH = (h - inset * 2 - (count - 1) * gap) / count;
    for (let d = 0; d < count; d++) {
      const dy = y + inset + d * (singleH + gap);
      elements.push(
        <rect
          key={`drawer-${id}-${d}`}
          x={x + inset}
          y={dy}
          width={w - inset * 2}
          height={singleH}
          fill="none"
          stroke="#6b7280"
          strokeWidth={0.75}
          rx={1}
        />
      );
      elements.push(
        <line
          key={`handle-drawer-${id}-${d}`}
          x1={x + w / 2 - 8}
          y1={dy + singleH / 2}
          x2={x + w / 2 + 8}
          y2={dy + singleH / 2}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      );
    }
  } else if (layoutType === "open") {
    // Dashed shelves
    const shelfCount = Math.max(1, Math.floor(h / 30));
    const shelfSpacing = h / (shelfCount + 1);
    for (let s = 1; s <= shelfCount; s++) {
      const sy = y + s * shelfSpacing;
      elements.push(
        <line
          key={`shelf-${id}-${s}`}
          x1={x + inset}
          y1={sy}
          x2={x + w - inset}
          y2={sy}
          stroke="#d1d5db"
          strokeWidth={0.75}
          strokeDasharray="4 3"
        />
      );
    }
  }
}
