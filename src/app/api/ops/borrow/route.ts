import { NextRequest, NextResponse } from "next/server";
import { executeBorrow, findBorrowCandidates } from "@/lib/purchasing/borrowAnalysis";
import { triggerInventoryRecalcForMaterial } from "@/lib/observability/recalculateProjectState";
import { requireRole } from "@/lib/auth/session";

/**
 * GET /api/ops/borrow?materialCode=XXX&excludeProjectId=YYY
 * Find borrow candidates for a material.
 *
 * POST /api/ops/borrow
 * Execute a cross-project borrow.
 * Body: { materialCode, quantity, lenderProjectId, borrowerProjectId }
 */

export async function GET(req: NextRequest) {
  const materialCode = req.nextUrl.searchParams.get("materialCode");
  const excludeProjectId = req.nextUrl.searchParams.get("excludeProjectId") ?? "";

  if (!materialCode) {
    return NextResponse.json({ error: "materialCode required" }, { status: 400 });
  }

  const candidates = await findBorrowCandidates(materialCode, excludeProjectId);
  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "planner"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { materialCode, quantity, lenderProjectId, borrowerProjectId } = body;

    if (!materialCode || !quantity || !lenderProjectId || !borrowerProjectId) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const result = await executeBorrow({ materialCode, quantity, lenderProjectId, borrowerProjectId });

    if (result.success) {
      // Trigger recalculations
      triggerInventoryRecalcForMaterial(materialCode).catch(() => {});
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("POST /api/ops/borrow error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
