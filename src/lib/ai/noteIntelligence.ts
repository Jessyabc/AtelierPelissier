/**
 * Note intelligence: parse informal user input into structured intents.
 *
 * This module provides regex-based pre-parsing for common patterns
 * that can supplement GPT's function calling. The AI uses this as a
 * hint layer — the final interpretation is always confirmed by GPT.
 *
 * Material aliases are loaded from AppConfig (Admin Hub) with hardcoded
 * defaults as fallback.
 */

import { getAppConfig, getMaterialAliases, DEFAULT_MATERIAL_ALIASES } from "@/lib/config";

export type ParsedIntent = {
  action: string;
  confidence: number;
  materialCode?: string;
  quantity?: number;
  projectRef?: string;
  rawText: string;
};

// Loaded at runtime from AppConfig; falls back to defaults
let _cachedAliases: Record<string, string> | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 60_000; // refresh aliases every 60s

async function loadAliases(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_cachedAliases && now - _cacheTimestamp < CACHE_TTL) return _cachedAliases;
  try {
    const config = await getAppConfig();
    _cachedAliases = getMaterialAliases(config);
  } catch {
    _cachedAliases = DEFAULT_MATERIAL_ALIASES;
  }
  _cacheTimestamp = now;
  return _cachedAliases;
}

function getAliasesSync(): Record<string, string> {
  return _cachedAliases ?? DEFAULT_MATERIAL_ALIASES;
}

/**
 * Pre-parse a message to detect common patterns.
 * Returns candidate intents sorted by confidence.
 * Uses synchronous alias cache; call ensureAliasesLoaded() first for fresh data.
 */
export function parseNoteIntents(text: string): ParsedIntent[] {
  const aliases = getAliasesSync();
  const intents: ParsedIntent[] = [];
  const lower = text.toLowerCase().trim();

  const resolveAlias = (raw: string): string | null => {
    const normalized = raw.toLowerCase().trim();
    for (const [alias, code] of Object.entries(aliases)) {
      if (normalized.includes(alias)) return code;
    }
    return null;
  };

  // Pattern: "add N [material]" or "ajoute N [material]"
  const addPattern = /(?:add|ajoute|ajout|need|besoin de?)\s+(\d+)\s+(.+?)(?:\s+(?:to|pour|for|au)\s+(.+))?$/i;
  const addMatch = lower.match(addPattern);
  if (addMatch) {
    const qty = parseInt(addMatch[1]);
    const materialRaw = addMatch[2].trim().replace(/s$/, "");
    const projectRef = addMatch[3]?.trim();
    const materialCode = resolveAlias(materialRaw);

    intents.push({
      action: "addMaterial",
      confidence: materialCode ? 0.9 : 0.6,
      materialCode: materialCode ?? materialRaw,
      quantity: qty,
      projectRef,
      rawText: text,
    });
  }

  // Pattern: "order N [material]" or "commande N [material]"
  const orderPattern = /(?:order|commande|commander|buy|achete)\s+(\d+)\s+(.+?)(?:\s+(?:from|de|chez)\s+(.+))?$/i;
  const orderMatch = lower.match(orderPattern);
  if (orderMatch) {
    const qty = parseInt(orderMatch[1]);
    const materialRaw = orderMatch[2].trim().replace(/s$/, "");
    const materialCode = resolveAlias(materialRaw);

    intents.push({
      action: "createOrder",
      confidence: materialCode ? 0.85 : 0.5,
      materialCode: materialCode ?? materialRaw,
      quantity: qty,
      rawText: text,
    });
  }

  // Pattern: "status of [project]" or "comment va [project]"
  const statusPattern = /(?:status|état|etat|comment va|how is|what's up with)\s+(.+?)$/i;
  const statusMatch = lower.match(statusPattern);
  if (statusMatch) {
    intents.push({
      action: "getProjectStatus",
      confidence: 0.8,
      projectRef: statusMatch[1].trim(),
      rawText: text,
    });
  }

  // Pattern: "check stock" or "inventory" or "what do we have"
  if (/(?:stock|inventory|inventaire|what do we have|qu'est-ce qu'on a)/i.test(lower)) {
    intents.push({
      action: "getInventoryStatus",
      confidence: 0.7,
      rawText: text,
    });
  }

  // Pattern: "what's short" or "shortages"
  if (/(?:short|shortage|manque|pénurie|penuri|what do we need|missing)/i.test(lower)) {
    intents.push({
      action: "getShortages",
      confidence: 0.7,
      rawText: text,
    });
  }

  return intents.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build a hint string from parsed intents for the AI system prompt.
 * Ensures aliases are fresh before parsing.
 */
export async function buildIntentHint(text: string): Promise<string | null> {
  await loadAliases();
  const intents = parseNoteIntents(text);
  if (intents.length === 0) return null;

  const best = intents[0];
  const parts = [`Detected intent: ${best.action} (confidence: ${best.confidence})`];
  if (best.materialCode) parts.push(`Material: ${best.materialCode}`);
  if (best.quantity) parts.push(`Quantity: ${best.quantity}`);
  if (best.projectRef) parts.push(`Project: ${best.projectRef}`);

  return parts.join(", ");
}
