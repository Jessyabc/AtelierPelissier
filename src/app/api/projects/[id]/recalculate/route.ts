import { NextResponse } from "next/server";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";
import { requireProjectAccess } from "@/lib/auth/guard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  await recalculateProjectState(projectId);
  return NextResponse.json({ ok: true });
}
