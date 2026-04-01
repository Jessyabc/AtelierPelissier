import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { fetchMondayBoards } from "@/lib/monday";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/monday/boards — admin only; uses saved key from AppConfig.
 * POST — admin only; body `{ apiKey?: string }` uses that key for this request (so "Test connection"
 * works before Save). If apiKey omitted/empty, falls back to saved config.
 */
export async function GET() {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  try {
    const config = await getAppConfig();
    const apiKey = config.integrations?.mondayApiKey as string | undefined;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        {
          error:
            "No Monday API key saved yet. Paste your token in the field and use Test connection (it uses the field without saving), or save Integrations first.",
        },
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

export async function POST(req: NextRequest) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  try {
    let body: { apiKey?: string } = {};
    try {
      body = (await req.json()) as { apiKey?: string };
    } catch {
      /* empty body */
    }
    const fromBody = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const config = await getAppConfig();
    const fromDb = (config.integrations?.mondayApiKey as string | undefined)?.trim() ?? "";
    const apiKey = fromBody || fromDb;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No API key: paste your Monday.com personal API token in the field, then Test connection again.",
        },
        { status: 400 }
      );
    }

    const boards = await fetchMondayBoards(apiKey);
    return NextResponse.json({ boards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monday API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
