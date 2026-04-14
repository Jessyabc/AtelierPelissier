/**
 * Role-based "next action" resolver.
 *
 * Given a project's current state and the viewing user's role, returns the
 * single most-important next action the user should take. This is the spine
 * of the guided workflow — every project card and project detail page uses
 * this to render its primary CTA.
 *
 * The goal: the user should never have to think "where do I go next?"
 */

import type { AppRole } from "@/lib/auth/roles";

export type NextAction = {
  /** Short verb-first label for the button ("Configure rooms", "Review estimate"). */
  label: string;
  /** Route (or tab anchor) the action points to. */
  href: string;
  /** Why this action is suggested — optional tooltip/subtext. */
  reason?: string;
  /** Visual tone for the CTA. */
  tone: "primary" | "neutral" | "warning" | "success";
  /** True when the project has nothing more for this role to do. */
  terminal?: boolean;
};

/**
 * Sales lifecycle stage.
 *
 * - `quote`     — working estimate, no invoice issued ("quick quote")
 * - `invoiced`  — invoice issued, awaiting deposit
 * - `confirmed` — deposit received, greenlit for production
 *
 * A project can be in any stage independent of isDraft/isDone. The stage is
 * what drives the salesperson path; planner/woodworker only care about it
 * insofar as stage=quote means "don't touch yet".
 */
export type ProjectStage = "quote" | "invoiced" | "confirmed";

/** Minimal project shape needed by the resolver — any richer type assignable. */
export type NextActionProject = {
  id: string;
  isDraft: boolean;
  isDone: boolean;
  types?: string | null;
  stage?: ProjectStage | string | null;
  depositReceivedAt?: string | null;
  clientId?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  targetDate?: string | null;
  projectItems?: Array<{ id: string }> | null;
  costLines?: Array<{ amount: number; kind?: string }> | null;
  sellingPrice?: number | null;
  blockedReason?: string | null;
  /** Whether any saved material snapshot is out of date. */
  hasStaleMaterialSnapshot?: boolean;
  /** Whether a saved material snapshot exists at all. */
  hasMaterialSnapshot?: boolean;
};

/**
 * Resolve the next action for a project given a role.
 *
 * The rules encode each role's guided story:
 * - salesperson: capture → configure → estimate → send → close
 * - planner:     intake → verify materials → schedule → release
 * - woodworker:  build (they don't see project detail for now)
 * - admin:       sees the planner path by default
 */
export function getNextAction(
  project: NextActionProject,
  role: AppRole | string
): NextAction {
  const done = project.isDone;
  const draft = project.isDraft;
  const hasClient = Boolean(project.clientId || project.clientFirstName || project.clientLastName);
  const hasRooms = (project.projectItems?.length ?? 0) > 0;
  const hasCostLines = (project.costLines?.length ?? 0) > 0;
  const hasPrice = (project.sellingPrice ?? 0) > 0;

  // Terminal state: project is done — nothing more to advance.
  if (done) {
    return {
      label: "View project",
      href: `/projects/${project.id}`,
      reason: "Project is complete",
      tone: "success",
      terminal: true,
    };
  }

  // Salesperson story — capture → configure → estimate → invoice → deposit → confirm
  if (role === "salesperson") {
    if (!hasClient) {
      return {
        label: "Add client",
        href: `/projects/${project.id}?tab=Client+%26+Info`,
        reason: "Client information missing",
        tone: "primary",
      };
    }
    if (!hasRooms) {
      return {
        label: "Add rooms",
        href: `/projects/${project.id}`,
        reason: "No rooms configured yet",
        tone: "primary",
      };
    }
    if (!hasCostLines && !hasPrice) {
      return {
        label: "Build estimate",
        href: `/projects/${project.id}?tab=Estimates+%26+Costs`,
        reason: "No pricing yet",
        tone: "primary",
      };
    }
    // Stage branch — everything below assumes the project at least has a price.
    const stage = project.stage ?? "confirmed";
    if (stage === "quote") {
      // A quick quote just needs to be sent or turned into an invoice.
      return {
        label: "Send quote",
        href: `/projects/${project.id}?tab=Estimates+%26+Costs`,
        reason: "Quick quote — send to client or convert to invoice",
        tone: "primary",
      };
    }
    if (stage === "invoiced") {
      return {
        label: "Confirm deposit",
        href: `/projects/${project.id}?tab=Client+%26+Info`,
        reason: "Awaiting deposit on invoice",
        tone: "warning",
      };
    }
    // stage === "confirmed"
    if (draft) {
      return {
        label: "Save project",
        href: `/projects/${project.id}`,
        reason: "Draft — save to move to ongoing",
        tone: "primary",
      };
    }
    return {
      label: "Hand off to shop",
      href: `/projects/${project.id}?tab=Production`,
      reason: "Deposit received — project is greenlit",
      tone: "success",
    };
  }

  // Planner story — intake to production-ready
  if (role === "planner" || role === "admin") {
    // Sales lifecycle gates — planner doesn't plan projects until sales are in.
    const stage = project.stage ?? "confirmed";
    if (stage === "quote") {
      return {
        label: "Waiting on sales",
        href: `/projects/${project.id}`,
        reason: "Still a quote — not yet invoiced",
        tone: "neutral",
      };
    }
    if (stage === "invoiced") {
      return {
        label: "Waiting on deposit",
        href: `/projects/${project.id}`,
        reason: "Invoice issued, deposit not yet received",
        tone: "neutral",
      };
    }
    if (project.blockedReason) {
      return {
        label: "Resolve block",
        href: `/projects/${project.id}`,
        reason: project.blockedReason,
        tone: "warning",
      };
    }
    if (!hasRooms) {
      return {
        label: "Review intake",
        href: `/projects/${project.id}`,
        reason: "Project is missing room configuration",
        tone: "primary",
      };
    }
    if (project.hasStaleMaterialSnapshot) {
      return {
        label: "Regenerate materials",
        href: `/projects/${project.id}`,
        reason: "Saved material estimate is out of date",
        tone: "warning",
      };
    }
    if (!project.hasMaterialSnapshot) {
      return {
        label: "Verify materials",
        href: `/projects/${project.id}`,
        reason: "No saved material snapshot yet",
        tone: "primary",
      };
    }
    if (draft) {
      return {
        label: "Save project",
        href: `/projects/${project.id}`,
        reason: "Still a draft",
        tone: "primary",
      };
    }
    if (!project.targetDate) {
      return {
        label: "Schedule",
        href: `/projects/${project.id}?tab=Production`,
        reason: "No target date set",
        tone: "primary",
      };
    }
    return {
      label: "Release to shop",
      href: `/projects/${project.id}?tab=Production`,
      reason: "Ready for production assignment",
      tone: "neutral",
    };
  }

  // Woodworker story — build
  if (role === "woodworker") {
    return {
      label: "Open build sheet",
      href: `/projects/${project.id}?tab=Production`,
      reason: "Today's build",
      tone: "primary",
    };
  }

  // Default fallback
  return {
    label: "Open project",
    href: `/projects/${project.id}`,
    tone: "neutral",
  };
}

/** Short human-readable role label used in UI copy. */
export function roleDisplayName(role: string): string {
  switch (role) {
    case "admin": return "Admin";
    case "planner": return "Planner";
    case "salesperson": return "Sales";
    case "woodworker": return "Shop";
    default: return role;
  }
}
