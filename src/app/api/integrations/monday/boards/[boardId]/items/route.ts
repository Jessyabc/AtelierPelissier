import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { fetchMondayBoardItems } from "@/lib/monday";

/**
 * GET /api/integrations/monday/boards/[boardId]/items
 * Lists items on a Monday.com board (for AI or UI to pick one and create a draft project).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const config = await getAppConfig();
    const apiKey = config.integrations?.mondayApiKey as string | undefined;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Monday.com API key not configured. Add it in Admin Hub → Integrations." },
        { status: 400 }
      );
    }

    const items = await fetchMondayBoardItems(apiKey.trim(), boardId);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
