import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUser } from "@/lib/auth/session";
import { getOpenAIClient } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

type SuggestedRoom = {
  label: string;
  type: "vanity" | "kitchen" | "side_unit" | "closet" | "commercial" | "laundry" | "entertainment" | "custom";
  tasks?: string[];
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
    "Extract rooms/deliverables with short labels and optional task checklist per room.",
    "",
    "Rules:",
    "- Return ONLY JSON (no markdown).",
    "- rooms[].label: short human label (e.g. 'Master bath vanity', 'Kitchen base cabinets').",
    "- rooms[].type: one of vanity|kitchen|side_unit|closet|commercial|laundry|entertainment|custom.",
    "- rooms[].tasks: optional list of short tasks (max 8) relevant to that room.",
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
      .map((r) => ({
        label: r.label.trim().slice(0, 120),
        type: r.type ?? "custom",
        tasks: Array.isArray(r.tasks)
          ? r.tasks
              .filter((t) => typeof t === "string" && t.trim())
              .map((t) => t.trim().slice(0, 160))
              .slice(0, 8)
          : undefined,
      }));

    return NextResponse.json({ rooms: cleaned });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI parse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

