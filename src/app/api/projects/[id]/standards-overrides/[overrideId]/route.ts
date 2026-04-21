/**
 * Mutations on a specific standards-override, project-scoped.
 *
 * DELETE — cancel a pending override. Only the requester (or any admin/
 *          planner) may cancel. Approved/rejected overrides are immutable
 *          history and cannot be deleted from here.
 *
 * Approve / reject lives on /api/admin/standards-overrides/[id] since it is
 * tier-gated and belongs to the admin approval queue surface.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth/guard";

type Params = { id: string; overrideId: string };

export const DELETE = withProjectAuth<Params>(
  ["admin", "planner", "salesperson"],
  async ({ params, session }) => {
    const { id: projectId, overrideId } = params;

    const row = await prisma.standardsOverride.findUnique({
      where: { id: overrideId },
      select: {
        id: true,
        projectId: true,
        status: true,
        requestedByUserId: true,
      },
    });
    if (!row || row.projectId !== projectId) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending overrides can be cancelled." },
        { status: 409 }
      );
    }

    const role = session.effectiveRole;
    const isOwner = row.requestedByUserId === session.dbUser.id;
    const isStaff = role === "admin" || role === "planner";
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.standardsOverride.delete({ where: { id: overrideId } });
    return NextResponse.json({ ok: true });
  }
);
