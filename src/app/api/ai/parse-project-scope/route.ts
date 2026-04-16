import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUser } from "@/lib/auth/session";
import { getOpenAIClient } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

// Suggestion shape — intentionally rooms-only.
//
// Process steps belong to the `ProcessTemplate` layer which admins curate;
// the AI should not invent per-room step lists. Keeping this small also
// reduces hallucination and makes it trivial for the wizard to map
// suggestions → default process templates via `resolveDefaultProcessTemplateId`.
type SuggestedRoom = {
  label: string;
  type: "vanity" | "kitchen" | "side_unit" | "closet" | "commercial" | "laundry" | "entertainment" | "custom";
  /** Optional integer: how many of this room/deliverable the scope implies. */
  count?: number;
};

/**
 * POST /api/ai/parse-project-scope
 * Body: { text: string }
 *
 * Returns: { rooms: SuggestedRoom[] }
 *
 * Intentionally conservative: suggestions are NOT persisted; UI lets user review & apply.
 */
export async function POST(req: NextRequest) {
  const auth = await getSessionWithUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body as { text?: string }).text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const openai = getOpenAIClient();
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();

  const prompt = [
    "You are helping a cabinetry shop turn messy scope notes into structured project rooms (deliverables).",
    "Return ONLY the room definitions. Do NOT invent process steps or task lists — ",
    "process assignment is handled downstream by the app.",
    "",
    "Rules:",
    "- Return ONLY JSON (no markdown) of shape { rooms: Room[] }.",
    "- rooms[].label: short human label (e.g. 'Master bath vanity', 'Kitchen base cabinets').",
    "- rooms[].type: one of vanity|kitchen|side_unit|closet|commercial|laundry|entertainment|custom.",
    "- rooms[].count: integer >= 1 when the note clearly implies repetition",
    "  (e.g. 'two vanities' -> count: 2). Omit or set to 1 when unclear.",
    "- Detect synonyms in French + English (vanité=vanity, cuisine=kitchen, îlot=kitchen,",
    "  salle de bain / meuble lavabo => vanity, penderie / walk-in => closet,",
    "  unité de rangement / storage unit => side_unit, etc.).",
    "- If the note is ambiguous, still propose best-effort rooms; do not ask questions in JSON.",
    "",
    "Input note:",
    text,
  ].join("\n");

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to salvage JSON surrounded by text
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } else {
        return NextResponse.json({ error: "Model did not return valid JSON", raw: raw.slice(0, 500) }, { status: 502 });
      }
    }

    const rooms = (parsed as { rooms?: SuggestedRoom[] }).rooms;
    if (!Array.isArray(rooms)) {
      return NextResponse.json({ error: "Invalid response shape", raw: parsed }, { status: 502 });
    }

    const cleaned: SuggestedRoom[] = rooms
      .filter((r) => r && typeof r.label === "string" && r.label.trim())
      .slice(0, 30)
      .map((r) => {
        const rawCount = typeof r.count === "number" ? r.count : 1;
        const count = Number.isFinite(rawCount)
          ? Math.min(Math.max(Math.round(rawCount), 1), 20)
          : 1;
        return {
          label: r.label.trim().slice(0, 120),
          type: r.type ?? "custom",
          count,
        };
      });

    return NextResponse.json({ rooms: cleaned });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI parse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

