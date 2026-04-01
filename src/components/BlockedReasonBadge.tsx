"use client";

import { blockedReasonLabel } from "@/lib/blockedReasonLabels";

export function BlockedReasonBadge({
  reason,
  className = "",
}: {
  reason: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 border border-red-200 ${className}`}
      title={blockedReasonLabel(reason)}
    >
      Blocked · {blockedReasonLabel(reason)}
    </span>
  );
}
