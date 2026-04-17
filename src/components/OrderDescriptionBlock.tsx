"use client";

/**
 * OrderDescriptionBlock — copy-pastable order description for a project.
 *
 * Used in two places:
 *   1. SalesProjectSummary — the only block a salesperson sees once the
 *      project is invoiced / confirmed.
 *   2. VanityTab (planner view) — added above the builder when invoiced /
 *      confirmed so the planner can grab the same text without leaving
 *      their working context.
 *
 * The component is intentionally stateless aside from the local "copied"
 * indicator — all data comes from the `ProjectLike` prop.
 */

import { useMemo, useState } from "react";
import toast from "react-hot-toast";

type VanitySectionRaw = {
  widthIn?: number;
  width?: number;
  drawerCount?: number;
  doorCount?: number;
  drawers?: number;
  doors?: number;
  kind?: string;
  layoutType?: string;
  id?: string;
};

type PanelPart = { id: string; label: string; qty: number };
type PrerequisiteLine = {
  id: string;
  materialCode: string;
  category: string;
  quantity: number;
  needed: boolean;
};

export type OrderDescriptionProject = {
  id: string;
  name: string;
  jobNumber?: string | null;
  stage?: string | null;
  panelParts: PanelPart[];
  prerequisiteLines?: PrerequisiteLine[];
  vanityInputs?: {
    width?: number | null;
    depth?: number | null;
    height?: number | null;
    framingStyle?: string | null;
    mountingStyle?: string | null;
    doorStyle?: string | null;
    numberOfSinks?: string | null;
    sections?: string | null;
  } | null;
};

function parseSections(json: string | null | undefined): VanitySectionRaw[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as VanitySectionRaw[]) : [];
  } catch {
    return [];
  }
}

function formatDim(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const rounded = Math.round(Number(n) * 100) / 100;
  return `${rounded}"`;
}

/**
 * Pure text builder so the same description can be copied, rendered, or
 * downloaded in the future without duplicating the formatting.
 */
export function buildOrderDescription(
  project: OrderDescriptionProject,
  totals: { panelQty: number; hinges: number; drawerBoxes: number }
): string {
  const lines: string[] = [];
  lines.push(
    `${project.jobNumber ? `${project.jobNumber} — ` : ""}${project.name}`
  );
  const v = project.vanityInputs;
  if (v && (v.width || v.height || v.depth)) {
    lines.push("");
    lines.push(
      `Vanity — ${formatDim(v.width)} W × ${formatDim(v.height)} H × ${formatDim(v.depth)} D`
    );
    if (v.framingStyle) lines.push(`Framing: ${v.framingStyle}`);
    if (v.mountingStyle) lines.push(`Mounting: ${v.mountingStyle}`);
    if (v.doorStyle) lines.push(`Door style: ${v.doorStyle}`);
    if (v.numberOfSinks) lines.push(`Sinks: ${v.numberOfSinks}`);

    const sections = parseSections(v.sections);
    if (sections.length > 0) {
      lines.push("");
      lines.push("Sections (left → right):");
      sections.forEach((s, idx) => {
        const parts: string[] = [];
        const width = s.widthIn ?? s.width;
        parts.push(`#${idx + 1}: ${formatDim(width)} wide`);
        const kind = s.kind ?? s.layoutType;
        if (kind) parts.push(String(kind).replace(/_/g, " "));
        const drawerCount = s.drawerCount ?? s.drawers;
        const doorCount = s.doorCount ?? s.doors;
        if (drawerCount && drawerCount > 0)
          parts.push(`${drawerCount} drawer${drawerCount > 1 ? "s" : ""}`);
        if (doorCount && doorCount > 0)
          parts.push(`${doorCount} door${doorCount > 1 ? "s" : ""}`);
        lines.push(`  - ${parts.join(" · ")}`);
      });
    }
  }
  lines.push("");
  lines.push(`Panels: ${totals.panelQty}`);
  if (totals.hinges > 0) lines.push(`Hinges: ${totals.hinges}`);
  if (totals.drawerBoxes > 0)
    lines.push(`Drawer boxes: ${totals.drawerBoxes}`);
  return lines.join("\n");
}

export function computeOrderTotals(project: OrderDescriptionProject) {
  const panelQty = project.panelParts.reduce((s, p) => s + (p.qty ?? 0), 0);
  const prereqs = project.prerequisiteLines ?? [];
  const hinges = prereqs
    .filter((p) => p.needed && p.category === "hinges")
    .reduce((s, p) => s + p.quantity, 0);
  const drawerBoxes = prereqs
    .filter((p) => p.needed && p.category === "drawer_boxes")
    .reduce((s, p) => s + p.quantity, 0);
  return { panelQty, hinges, drawerBoxes };
}

type Props = {
  project: OrderDescriptionProject;
  /**
   * Title shown above the copy block. Defaults to "Order description".
   * The planner view sometimes overrides this for context.
   */
  title?: string;
  /** Optional one-line subtitle describing why this block is shown. */
  subtitle?: string;
};

export function OrderDescriptionBlock({ project, title, subtitle }: Props) {
  const totals = useMemo(() => computeOrderTotals(project), [project]);
  const description = useMemo(
    () => buildOrderDescription(project, totals),
    [project, totals]
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      toast.success("Order description copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  return (
    <div className="neo-panel-inset p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            {title ?? "Order description"}
          </div>
          {subtitle && (
            <div className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        <button type="button" onClick={copy} className="neo-btn px-3 py-1 text-xs">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[var(--foreground)]">
        {description || "No details yet."}
      </pre>
    </div>
  );
}
