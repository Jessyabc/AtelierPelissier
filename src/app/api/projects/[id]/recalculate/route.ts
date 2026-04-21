import { NextResponse } from "next/server";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

// Full state recalculation is admin/planner only — heavy operation and
// planner-facing. Sales save flows use the lighter `recalc-status` trigger.
export const POST = withAuth<{ id: string }>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId } = params;
    await recalculateProjectState(projectId);
    return NextResponse.json({ ok: true });
  }
);
