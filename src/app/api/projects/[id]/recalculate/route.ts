import { NextResponse } from "next/server";
import { recalculateProjectState } from "@/lib/observability/recalculateProjectState";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  await recalculateProjectState(projectId);
  return NextResponse.json({ ok: true });
}
