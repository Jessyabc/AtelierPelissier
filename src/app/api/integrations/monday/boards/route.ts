import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { fetchMondayBoards } from "@/lib/monday";

/**
 * GET /api/integrations/monday/boards
 * Lists Monday.com boards (requires API key in Admin Hub → Integrations).
 */
export async function GET() {
  try {
    const config = await getAppConfig();
    const apiKey = config.integrations?.mondayApiKey as string | undefined;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Monday.com API key not configured. Add it in Admin Hub → Integrations." },
        { status: 400 }
      );
    }

    const boards = await fetchMondayBoards(apiKey.trim());
    return NextResponse.json({ boards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
