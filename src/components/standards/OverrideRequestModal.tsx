"use client";

/**
 * OverrideRequestModal — small dialog used by builder fields to request
 * a one-off deviation from a shop standard on this project.
 *
 * Lives next to StandardsContext because the request path (POST to
 * /api/projects/[id]/standards-overrides) is owned by the context's
 * `requestOverride` call — the modal is purely presentational.
 *
 * UX rules
 * ────────
 *   - Shows the canonical standard value at the top ("Standard: 34.75 in")
 *     so the user understands what they're deviating from.
 *   - Pre-fills the new value from whatever they tried to type.
 *   - Surfaces the risk tier badge ("Admin review" vs "Planner review")
 *     so there are no surprises after submission.
 *   - Reason is optional but nudged via placeholder text.
 */

import { useEffect, useState } from "react";
import { classifyOverride } from "@/lib/standards/overridePolicy";
import type { StandardKey } from "./StandardsContext";

export type OverrideRequestModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (args: {
    standardKey: StandardKey;
    overrideValue: number;
    reason: string | null;
  }) => Promise<void>;
  /** Standard being overridden. */
  standardKey: StandardKey;
  /** Human label for the field (e.g. "Kitchen base height"). */
  fieldLabel: string;
  /** Current canonical value. */
  standardValue: number;
  /** User's attempted value — modal seeds its input from here. */
  proposedValue: number;
  /** Display unit (in, mm, days…). */
  unit?: string;
};

export function OverrideRequestModal({
  open,
  onClose,
  onSubmit,
  standardKey,
  fieldLabel,
  standardValue,
  proposedValue,
  unit = "in",
}: OverrideRequestModalProps) {
  const [value, setValue] = useState<string>(String(proposedValue));
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the modal opens for a different proposed value — we
  // share one modal across many fields.
  useEffect(() => {
    if (open) {
      setValue(String(proposedValue));
      setReason("");
      setError(null);
    }
  }, [open, proposedValue]);

  if (!open) return null;

  const classification = classifyOverride(standardKey);
  const tierLabel =
    classification.tier === "high" ? "Admin review required" : "Planner review";
  const tierClass =
    classification.tier === "high"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";

  const parsed = Number(value);
  const canSubmit =
    !submitting && Number.isFinite(parsed) && parsed > 0 && parsed !== standardValue;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        standardKey,
        overrideValue: parsed,
        reason: reason.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-modal-title"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="neo-card w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="override-modal-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              Request override
            </h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              {fieldLabel} — deviating from shop standard
            </p>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${tierClass}`}>
            {tierLabel}
          </span>
        </div>

        <div className="neo-panel-inset p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[var(--foreground-muted)]">Standard</span>
            <span className="font-medium tabular-nums">
              {standardValue} {unit}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[var(--foreground-muted)]">Requested</span>
            <span className="font-medium tabular-nums text-[var(--accent)]">
              {Number.isFinite(parsed) ? parsed : "—"} {unit}
            </span>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">
            New value ({unit})
          </span>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="neo-input w-full px-3 py-2 text-sm"
            autoFocus
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">
            Reason (optional — helps the reviewer)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Client wants deeper drawer for appliance garage"
            rows={2}
            className="neo-input w-full px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="neo-btn px-3 py-1.5 text-sm"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="neo-btn-primary px-4 py-1.5 text-sm"
            disabled={!canSubmit}
          >
            {submitting ? "Submitting…" : "Request override"}
          </button>
        </div>
      </form>
    </div>
  );
}
