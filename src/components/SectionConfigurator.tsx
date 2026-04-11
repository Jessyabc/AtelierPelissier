"use client";

import { useCallback, useRef, useState } from "react";
import type { VanitySection, SideUnitSection, VanitySectionLayout, SideUnitSectionLayout } from "@/lib/ingredients/types";

// ---------------------------------------------------------------------------
// Layout options with labels
// ---------------------------------------------------------------------------

const VANITY_LAYOUTS: { value: VanitySectionLayout; label: string }[] = [
  { value: "doors", label: "Doors" },
  { value: "drawer_over_doors", label: "Drawer + Doors" },
  { value: "doors_over_drawer", label: "Doors + Drawer" },
  { value: "all_drawers", label: "All Drawers" },
  { value: "open", label: "Open" },
];

const SIDE_UNIT_LAYOUTS: { value: SideUnitSectionLayout; label: string }[] = [
  { value: "doors", label: "Doors" },
  { value: "drawers", label: "Drawers" },
  { value: "open", label: "Open" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props =
  | {
      direction: "horizontal";
      sections: VanitySection[];
      onSectionsChange: (sections: VanitySection[]) => void;
      totalDimension: number; // total width for vanity
      minSection: number;
    }
  | {
      direction: "vertical";
      sections: SideUnitSection[];
      onSectionsChange: (sections: SideUnitSection[]) => void;
      totalDimension: number; // total height for side unit
      minSection: number;
    };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectionConfigurator(props: Props) {
  const { direction, totalDimension, minSection } = props;
  const sections = props.sections;
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const isHorizontal = direction === "horizontal";
  const dimensionLabel = isHorizontal ? "Width" : "Height";
  const layouts = isHorizontal ? VANITY_LAYOUTS : SIDE_UNIT_LAYOUTS;

  // Calculate remaining space
  const usedDimension = sections.reduce(
    (sum, s) => sum + ("width" in s ? s.width : s.height),
    0
  );
  const remaining = totalDimension - usedDimension;

  // ---------------------------------------------------------------------------
  // Section CRUD
  // ---------------------------------------------------------------------------

  const addSection = useCallback(() => {
    const newWidth = Math.max(minSection, remaining > 0 ? remaining : minSection);
    if (isHorizontal) {
      const onChange = props.onSectionsChange as (s: VanitySection[]) => void;
      const newSection: VanitySection = {
        id: `s${Date.now()}`,
        sortOrder: sections.length,
        layoutType: "doors",
        width: newWidth,
        doors: 1,
        drawers: 0,
      };
      onChange([...(sections as VanitySection[]), newSection]);
    } else {
      const onChange = props.onSectionsChange as (s: SideUnitSection[]) => void;
      const newSection: SideUnitSection = {
        id: `s${Date.now()}`,
        sortOrder: sections.length,
        layoutType: "doors",
        height: newWidth,
        doors: 1,
        drawers: 0,
      };
      onChange([...(sections as SideUnitSection[]), newSection]);
    }
    setActiveIndex(sections.length);
  }, [sections, isHorizontal, minSection, remaining, props.onSectionsChange]);

  const removeSection = useCallback(
    (index: number) => {
      if (sections.length <= 1) return;
      const updated = sections.filter((_, i) => i !== index);
      // Re-index sortOrder
      const reindexed = updated.map((s, i) => ({ ...s, sortOrder: i }));
      if (isHorizontal) {
        (props.onSectionsChange as (s: VanitySection[]) => void)(reindexed as VanitySection[]);
      } else {
        (props.onSectionsChange as (s: SideUnitSection[]) => void)(reindexed as SideUnitSection[]);
      }
      setActiveIndex(Math.min(activeIndex, reindexed.length - 1));
    },
    [sections, isHorizontal, activeIndex, props.onSectionsChange]
  );

  const updateSection = useCallback(
    (index: number, patch: Record<string, unknown>) => {
      const updated = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
      if (isHorizontal) {
        (props.onSectionsChange as (s: VanitySection[]) => void)(updated as VanitySection[]);
      } else {
        (props.onSectionsChange as (s: SideUnitSection[]) => void)(updated as SideUnitSection[]);
      }
    },
    [sections, isHorizontal, props.onSectionsChange]
  );

  // ---------------------------------------------------------------------------
  // Touch swipe handling (mobile)
  // ---------------------------------------------------------------------------

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const delta = isHorizontal ? dx : dy;
    const threshold = 50;

    if (Math.abs(delta) > threshold) {
      if (delta < 0) {
        // Swipe forward (right-to-left for horizontal, down-to-up for vertical)
        if (activeIndex < sections.length - 1) {
          setActiveIndex(activeIndex + 1);
        } else {
          // Swipe past last → add new section
          addSection();
        }
      } else {
        // Swipe backward
        if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
        }
      }
    }
    touchStart.current = null;
  };

  // ---------------------------------------------------------------------------
  // Render active section config form
  // ---------------------------------------------------------------------------

  const activeSection = sections[activeIndex];
  const activeDimension = activeSection
    ? "width" in activeSection
      ? activeSection.width
      : activeSection.height
    : 0;

  return (
    <div className="space-y-4">
      {/* Section indicator dots + navigation */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Sections:</span>
        <div className="flex items-center gap-1">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-3 w-3 rounded-full transition-colors ${
                i === activeIndex
                  ? "bg-gray-900"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              title={`Section ${i + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={addSection}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-400 text-gray-400 hover:border-gray-600 hover:text-gray-600"
            title="Add section"
          >
            +
          </button>
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {remaining > 0
            ? `${remaining.toFixed(1)}" remaining`
            : remaining < 0
              ? `${Math.abs(remaining).toFixed(1)}" over`
              : ""}
        </span>
      </div>

      {/* Swipeable section cards (mobile) */}
      <div
        ref={scrollRef}
        className="overflow-hidden rounded-lg border border-gray-200"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeSection && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                  disabled={activeIndex === 0}
                  className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  &larr;
                </button>
                <h4 className="text-sm font-medium text-gray-800">
                  Section {activeIndex + 1} of {sections.length}
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      Math.min(sections.length - 1, activeIndex + 1)
                    )
                  }
                  disabled={activeIndex === sections.length - 1}
                  className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  &rarr;
                </button>
              </div>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(activeIndex)}
                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Layout type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Layout
              </label>
              <div className="flex flex-wrap gap-1">
                {layouts.map((layout) => (
                  <button
                    key={layout.value}
                    type="button"
                    onClick={() =>
                      updateSection(activeIndex, { layoutType: layout.value })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeSection.layoutType === layout.value
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension (width for vanity, height for side unit) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {dimensionLabel} (in)
              </label>
              <input
                type="number"
                min={minSection}
                max={totalDimension}
                step={0.5}
                value={activeDimension}
                onChange={(e) => {
                  const key = isHorizontal ? "width" : "height";
                  updateSection(activeIndex, {
                    [key]: Math.max(minSection, Number(e.target.value) || minSection),
                  });
                }}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            {/* Doors count */}
            {activeSection.layoutType !== "open" &&
              activeSection.layoutType !== "all_drawers" &&
              (activeSection.layoutType !== "drawers" || !("height" in activeSection)) && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Doors
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    value={activeSection.doors}
                    onChange={(e) =>
                      updateSection(activeIndex, {
                        doors: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}

            {/* Drawers count */}
            {activeSection.layoutType !== "open" &&
              activeSection.layoutType !== "doors" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Drawers
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={activeSection.drawers}
                    onChange={(e) =>
                      updateSection(activeIndex, {
                        drawers: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
