/**
 * Default process-template resolver for room/deliverable types.
 *
 * Rule (captured from product direction):
 *   - A `vanity` deliverable defaults to the "Vanity" process.
 *   - A `side_unit` deliverable defaults to the "Side Unit" process.
 *   - A `kitchen` deliverable defaults to the "Kitchen" process.
 *   - Everything else (closet, commercial, laundry, entertainment, custom…)
 *     falls back to the "Kitchen" process until admin remaps it.
 *
 * An admin-owned customization layer (`AppConfig.processDefaults`) can
 * override any of these via `{ roomType: processTemplateId }`. When the
 * override is present and still valid, it wins. Otherwise we look up the
 * canonical template by name, then by heuristic match (case-insensitive).
 *
 * The resolver is deliberately side-effect free and DB-backed so both API
 * routes and AI handlers can share it without duplicating logic.
 */

import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";

/** Room/deliverable types we know how to map today. */
export type RoomType = string;

/** Canonical "primary" mapping (built in). Lowercased keys. */
const BUILT_IN_MAPPING: Record<string, string> = {
  vanity: "Vanity",
  side_unit: "Side Unit",
  kitchen: "Kitchen",
};

/** Fallback template name when no specific match is found. */
const FALLBACK_TEMPLATE_NAME = "Kitchen";

type ResolveResult = {
  processTemplateId: string | null;
  templateName: string | null;
  matchedBy: "admin_override" | "built_in_name" | "fuzzy_name" | "fallback" | "none";
};

function normaliseName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Resolve the default process template id for a given room type.
 *
 * Returns `{ processTemplateId: null }` when no matching template exists in
 * the DB — callers should surface that to the user (e.g. "create a Vanity
 * process first") rather than silently succeed.
 */
export async function resolveDefaultProcessTemplateId(
  roomType: RoomType
): Promise<ResolveResult> {
  const key = normaliseName(roomType || "custom");

  // 1) Admin override in AppConfig.processDefaults wins if it still points
  //    at a real template (the admin might have deleted/renamed it since).
  let config: Awaited<ReturnType<typeof getAppConfig>> | null = null;
  try {
    config = await getAppConfig();
  } catch {
    config = null;
  }
  const override = config?.processDefaults?.[key];
  if (override) {
    const exists = await prisma.processTemplate.findUnique({
      where: { id: override },
      select: { id: true, name: true },
    });
    if (exists) {
      return {
        processTemplateId: exists.id,
        templateName: exists.name,
        matchedBy: "admin_override",
      };
    }
  }

  // Load all templates once for name-based matching.
  const templates = await prisma.processTemplate.findMany({
    select: { id: true, name: true },
  });

  // 2) Exact match against the built-in mapping.
  const builtInName = BUILT_IN_MAPPING[key];
  if (builtInName) {
    const match = templates.find(
      (t) => normaliseName(t.name) === normaliseName(builtInName)
    );
    if (match) {
      return {
        processTemplateId: match.id,
        templateName: match.name,
        matchedBy: "built_in_name",
      };
    }
  }

  // 3) Fuzzy: template name that contains the key (e.g. "Kitchen – Standard").
  if (builtInName) {
    const fuzzy = templates.find((t) =>
      normaliseName(t.name).includes(normaliseName(builtInName))
    );
    if (fuzzy) {
      return {
        processTemplateId: fuzzy.id,
        templateName: fuzzy.name,
        matchedBy: "fuzzy_name",
      };
    }
  }

  // 4) Fallback to the "Kitchen" process if it exists.
  const fallback = templates.find(
    (t) => normaliseName(t.name) === normaliseName(FALLBACK_TEMPLATE_NAME)
  );
  if (fallback) {
    return {
      processTemplateId: fallback.id,
      templateName: fallback.name,
      matchedBy: "fallback",
    };
  }

  // Nothing — caller must handle.
  return { processTemplateId: null, templateName: null, matchedBy: "none" };
}
