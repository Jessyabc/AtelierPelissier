"use client";

import Link from "next/link";
import { getNextAction, type NextActionProject } from "@/lib/workflow/nextAction";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Props = {
  project: NextActionProject;
  /** Optional callback invoked when the button is clicked — used to pre-switch tabs. */
  onClick?: (href: string) => void;
  className?: string;
};

/**
 * Prominent role-aware "next action" CTA for the project detail page header.
 *
 * Resolves the next action via getNextAction() and renders it as a styled
 * link. The button is the primary way a user advances a project through its
 * role-specific story.
 */
export function NextActionButton({ project, onClick, className }: Props) {
  const { user } = useCurrentUser();
  const role = user?.role ?? "admin";
  const next = getNextAction(project, role);

  const baseClass =
    next.tone === "warning"
      ? "neo-btn border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      : next.tone === "success"
        ? "neo-btn text-emerald-700"
        : next.tone === "neutral"
          ? "neo-btn"
          : "neo-btn-primary";

  return (
    <Link
      href={next.href}
      onClick={() => onClick?.(next.href)}
      title={next.reason}
      className={`${baseClass} inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium ${className ?? ""}`}
    >
      <span>{next.label}</span>
      {!next.terminal && <span aria-hidden>→</span>}
    </Link>
  );
}
