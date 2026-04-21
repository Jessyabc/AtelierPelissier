/**
 * Project lifecycle transitions that don't fit cleanly into the generic
 * PATCH: archive, unarchive, mark-lost, mark-found.
 *
 * Each is a small, explicit action verb — the kind you want to audit-log
 * individually rather than tease out of a free-form update diff.
 *
 * Request shape:
 *   POST body = { action: "archive" | "unarchive" | "mark-lost" | "mark-found",
 *                 reason?: string }
 *
 * The corresponding project fields come from prisma/schema.prisma::Project:
 *   archivedAt, archiveReason, lostReason, lastSalesActivityAt.
 *
 * Authorization:
 *   - Requires project access (salesperson/planner/admin).
 *   - A salesperson may archive / mark-lost their own projects.
 *   - Unarchiving / un-losing is allowed from any of the three — we want
 *     the client-comes-back case to be a one-click recovery.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth/guard";
import { logAudit, type AuditAction } from "@/lib/audit";

type Params = { id: string };
type LifecycleAction = "archive" | "unarchive" | "mark-lost" | "mark-found";

const AUDIT_ACTION: Record<LifecycleAction, AuditAction> = {
  archive: "lifecycle_archived",
  unarchive: "lifecycle_unarchived",
  "mark-lost": "lifecycle_lost",
  "mark-found": "lifecycle_found",
};

export const POST = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ req, params }) => {
    const { id: projectId } = params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const action = raw.action as LifecycleAction | undefined;
    const reason =
      typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : null;

    if (
      action !== "archive" &&
      action !== "unarchive" &&
      action !== "mark-lost" &&
      action !== "mark-found"
    ) {
      return NextResponse.json(
        { error: "action must be archive | unarchive | mark-lost | mark-found" },
        { status: 400 }
      );
    }

    // mark-lost REQUIRES a reason — that's the whole point of the field.
    if (action === "mark-lost" && !reason) {
      return NextResponse.json(
        { error: "mark-lost requires a reason" },
        { status: 400 }
      );
    }

    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        archivedAt: true,
        archiveReason: true,
        lostReason: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build the update payload per action. Keep the transitions explicit so
    // future maintainers can read this as a little state machine.
    type ProjectUpdate = {
      archivedAt?: Date | null;
      archiveReason?: string | null;
      lostReason?: string | null;
      lastSalesActivityAt?: Date;
    };
    let update: ProjectUpdate;
    switch (action) {
      case "archive":
        if (existing.archivedAt) {
          return NextResponse.json({ error: "Project already archived" }, { status: 409 });
        }
        update = {
          archivedAt: new Date(),
          archiveReason: reason ?? "manual",
          // DO NOT bump lastSalesActivityAt — archiving is the OPPOSITE of
          // fresh sales activity, and we don't want the sweep to flip-flop.
        };
        break;
      case "unarchive":
        if (!existing.archivedAt) {
          return NextResponse.json({ error: "Project is not archived" }, { status: 409 });
        }
        update = {
          archivedAt: null,
          archiveReason: null,
          // Unarchiving = the sales team is paying attention again.
          lastSalesActivityAt: new Date(),
        };
        break;
      case "mark-lost":
        update = {
          lostReason: reason!,
          // A lost quote is also hidden from default lists — stamp archivedAt
          // so the existing filter logic Just Works.
          archivedAt: existing.archivedAt ?? new Date(),
          archiveReason: existing.archiveReason ?? "lost",
        };
        break;
      case "mark-found":
        if (!existing.lostReason) {
          return NextResponse.json({ error: "Project is not marked lost" }, { status: 409 });
        }
        update = {
          lostReason: null,
          archivedAt: null,
          archiveReason: null,
          lastSalesActivityAt: new Date(),
        };
        break;
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: update,
    });

    await logAudit(projectId, AUDIT_ACTION[action], reason);

    return NextResponse.json(updated);
  }
);
