"use client";

/**
 * ConstructionStandardField — a number input that represents ONE shop
 * construction standard on a per-project basis.
 *
 * What this component is (and isn't)
 * ──────────────────────────────────
 *   IS:   A field whose default value lives in `ConstructionStandards`
 *         and may be overridden per project (kitchenBaseHeight, etc.).
 *   ISNT: A generic dimension input. Per-section widths, drawer counts,
 *         and other per-configuration values use plain inputs.
 *
 * Display model
 * ─────────────
 *   Idle               → shows standard value + "Standard" chip, read-only-
 *                        looking but editable.
 *   Edited but unsaved → while user types, shows their value + a subtle
 *                        "Unsaved override" hint. On blur/commit we open
 *                        the modal to collect a reason.
 *   Pending override   → shows the PROPOSED value dimmed with an "Awaiting
 *                        review" chip. Pricing still uses the canonical
 *                        standard under the hood (see `useResolvedStandard`).
 *   Approved override  → shows the override value with an "Override
 *                        approved" chip. Pricing uses the override.
 *   Rejected override  → falls back to standard, with a "Last override
 *                        rejected" chip so the user knows not to re-submit.
 *
 * This component is intentionally dumb about pricing: it reports a value
 * via `onChange`, and the builder decides whether that value feeds the
 * live price or needs a snapshot refresh.
 */

import { useState } from "react";
import { useResolvedStandard, useStandardsContext } from "./StandardsContext";
import { OverrideRequestModal } from "./OverrideRequestModal";
import type { StandardKey } from "./StandardsContext";

export type ConstructionStandardFieldProps = {
  standardKey: StandardKey;
  /** Human-facing label ("Kitchen base height"). */
  label: string;
  /** Display unit, default "in". */
  unit?: string;
  /**
   * Optional section scope. When set, the field reads + writes
   * section-specific overrides (e.g. this one cabinet is 26" deep) rather
   * than project-level ones. Leave null/undefined for shop-wide overrides.
   */
  sectionId?: string | null;
  /**
   * Called with the effective value whenever it changes (either the user
   * typed a new value or the resolved value changed due to override
   * approval). Useful for keeping local form state in sync.
   */
  onEffectiveValueChange?: (value: number) => void;
  /** Disable the override flow — field becomes read-only. */
  readOnly?: boolean;
  /** Extra hint shown below the input (e.g. "Freestanding vanities only"). */
  hint?: string;
};

export function ConstructionStandardField({
  standardKey,
  label,
  unit = "in",
  sectionId = null,
  onEffectiveValueChange,
  readOnly = false,
  hint,
}: ConstructionStandardFieldProps) {
  const resolved = useResolvedStandard(standardKey, sectionId);
  const { requestOverride } = useStandardsContext();

  // Input tracks user keystrokes; commits back to `resolved.value` when we
  // drop focus without committing an override. This is the "edited but
  // unsaved" window.
  const [draft, setDraft] = useState<string>(String(resolved.value));
  const [modalOpen, setModalOpen] = useState(false);
  const [proposedForModal, setProposedForModal] = useState<number>(resolved.value);

  // Keep the draft synced when the resolved value shifts under us (e.g.
  // an override gets approved).
  const resolvedStr = String(resolved.value);
  if (!modalOpen && draft !== resolvedStr && !isUserTyping(draft, resolvedStr)) {
    // Only resync if the user isn't actively editing — "is editing" =
    // typed value differs from both the previous and current resolved.
    // See helper below.
  }

  function commitEdit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(resolved.value));
      return;
    }
    if (parsed === resolved.value) return; // no-op
    // Opening the modal is the ONLY way to persist a deviation — we don't
    // silently write overrides on blur.
    setProposedForModal(parsed);
    setModalOpen(true);
  }

  function cancelEdit() {
    setDraft(String(resolved.value));
    setModalOpen(false);
  }

  async function handleModalSubmit({
    overrideValue,
    reason,
  }: {
    standardKey: StandardKey;
    overrideValue: number;
    reason: string | null;
  }) {
    await requestOverride({
      standardKey,
      overrideValue,
      sectionId,
      reason,
    });
    // The new row is pending: pricing keeps using the standard until review.
    // Reset the visible draft to the standard so the UI reads honestly.
    setDraft(String(resolved.standardValue));
    onEffectiveValueChange?.(resolved.standardValue);
  }

  const chipClass = chipClassForSource(resolved.source, resolved.tier);
  const disabled = readOnly || resolved.source === "override-pending";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--foreground-muted)]">
          {label}
        </label>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${chipClass}`}>
          {resolved.provenanceLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              cancelEdit();
            }
          }}
          className={`neo-input flex-1 px-3 py-2 text-sm tabular-nums ${
            resolved.source === "override-pending" ? "opacity-70" : ""
          }`}
          aria-label={label}
        />
        <span className="text-xs text-[var(--foreground-muted)] w-8 text-right">
          {unit}
        </span>
      </div>

      {resolved.source !== "standard" && resolved.override ? (
        <p className="text-[11px] text-[var(--foreground-muted)]">
          Override {resolved.override.overrideValue} {unit} · reason:&nbsp;
          <span className="italic">{resolved.override.reason ?? "(none)"}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--foreground-muted)]">{hint}</p>
      ) : null}

      <OverrideRequestModal
        open={modalOpen}
        onClose={cancelEdit}
        onSubmit={handleModalSubmit}
        standardKey={standardKey}
        fieldLabel={label}
        standardValue={resolved.standardValue}
        proposedValue={proposedForModal}
        unit={unit}
      />
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────

function chipClassForSource(
  source: "standard" | "override-approved" | "override-pending" | "override-rejected",
  tier: "low" | "high"
): string {
  switch (source) {
    case "standard":
      return "bg-gray-100 text-gray-600";
    case "override-approved":
      return "bg-emerald-100 text-emerald-800";
    case "override-pending":
      return tier === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800";
    case "override-rejected":
      return "bg-gray-200 text-gray-700";
  }
}

/**
 * Heuristic: the user is "still typing" if their draft differs from both
 * the value they see and any plausible parsed form. We use this to avoid
 * overwriting keystrokes when the resolved value updates asynchronously
 * (e.g. after an override approval).
 *
 * Currently unused at the call site but kept here for when we wire the
 * resync — right now the `if (... && !isUserTyping(...))` branch is a
 * no-op because local state only updates via keystrokes. Leaving the
 * intent documented so future edits don't introduce a sync bug.
 */
function isUserTyping(draft: string, resolved: string): boolean {
  return draft !== resolved && draft !== "";
}
