/**
 * Monday.com API v2 (GraphQL) client.
 * Used to list boards, list items on a board, and map a Monday item to a draft project.
 *
 * API key is stored in AppConfig.integrations.mondayApiKey (Admin Hub → Integrations).
 * Optional board ID in AppConfig.integrations.mondayBoardId for "default projects board".
 */

const MONDAY_API_URL = "https://api.monday.com/v2";

/** Pin API version to avoid silent schema drift; override in Vercel if Monday deprecates a version. */
const MONDAY_API_VERSION = process.env.MONDAY_API_VERSION?.trim() || "2025-10";

export type MondayBoard = { id: string; name: string };
export type MondayColumnValue = {
  id: string;
  text?: string | null;
  value?: string | null;
  column?: { title?: string | null } | null;
};
/** Subitem has the same shape as a top-level item; used for Wood Shop and other boards with subitems. */
export type MondaySubitem = {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
};

export type MondayItem = {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
  /** Subitems (e.g. Wood Shop tasks under a parent item). Only present when requested and board supports them. */
  subitems?: MondaySubitem[] | null;
};
export type MondayItemForProject = {
  name: string;
  jobNumber: string | null;
  clientName: string | null;
  clientPhone: string | null;
  notes: string | null;
};

export type MondayProjectWithRooms = MondayItemForProject & {
  rooms: { label: string; type: string }[];
};

// ---------------------------------------------------------------------------
// Name parsing: extract MC-xxxx, client name, phone from Monday item names
// e.g. "MC-6576 (Ramon Galvan)" → { jobNumber: "MC-6576", clientName: "Ramon Galvan" }
// e.g. "MC-6513 Alexis Martin (514-808-2362)" → { jobNumber: "MC-6513", clientName: "Alexis Martin", clientPhone: "514-808-2362" }
// ---------------------------------------------------------------------------

const PHONE_RE = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export function parseMondayItemName(raw: string): {
  jobNumber: string | null;
  clientName: string | null;
  clientPhone: string | null;
} {
  let rest = raw.trim();
  if (!rest) return { jobNumber: null, clientName: null, clientPhone: null };

  // Extract MC-XXXX from start (handles MC6372 and MC-6372)
  let jobNumber: string | null = null;
  const mcMatch = rest.match(/^(MC-?\d+)\s*(.*)/i);
  if (mcMatch) {
    const mc = mcMatch[1].toUpperCase();
    jobNumber = mc.startsWith("MC-") ? mc : `MC-${mc.slice(2)}`;
    rest = mcMatch[2].trim();
  }

  // Extract phone
  const phoneMatch = rest.match(PHONE_RE);
  const clientPhone = phoneMatch
    ? phoneMatch[0].replace(/[^\d]/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
    : null;
  if (phoneMatch) rest = rest.replace(phoneMatch[0], "");

  // Strip "Client " prefix (e.g. "Client Gilles & Jocelyn")
  rest = rest.replace(/^Client\s+/i, "");

  // Strip parentheses, collapse whitespace
  rest = rest.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

  // Drop pure-note suffixes that aren't names (e.g. "Pas de facture", "Projet Mercier")
  // Heuristic: if after stripping MC + phone we only have note-like text with no capitals, skip
  const clientName = rest || null;

  return { jobNumber, clientName, clientPhone };
}

// Guess ProjectItem type from a subitem label (room/deliverable name)
export function guessRoomType(label: string): string {
  const l = normalizeLooseText(label);

  // More specific patterns first (e.g. "unite de rangement sur vanite" is a side_unit, not vanity)
  if (
    /(unite)\s+de\s+rangement/.test(l) ||
    /(storage\s+unit|rangement\s+(sur|de)|unite\s+de\s+rangement)/.test(l) ||
    /au\s+dessus\s+de\s+la\s+(laveuse|secheuse|secheuse)/.test(l)
  ) {
    return "side_unit";
  }

  // Closet / wardrobe (FR + EN)
  if (/(garde\s*-?\s*robe|penderie|walk\s*-?\s*in|closet)/.test(l)) return "closet";

  // Kitchen (FR + EN)
  if (/(cuisine|kitchen|ilot|îlot|pantry)/.test(l)) return "kitchen";

  // Vanity / bathroom (FR + EN)
  if (/(vanite|vanity|salle\s+de\s+bain|bath(room)?|lavabo)/.test(l)) return "vanity";

  // Non-room deliverables still map to "custom" today
  if (/(comptoir|counter(top)?|dekton)/.test(l)) return "custom";
  if (/(pharmacie|medicine\s+cabinet)/.test(l)) return "custom";

  return "custom";
}

function normalizeLooseText(input: string): string {
  // Normalization makes matching robust for accents (vanité/vanite), casing, and weird punctuation.
  // This is intentionally lossy: it's for inference, not display.
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[’'"]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a top-level Monday item (with subitems) to a Project + Rooms structure.
 * Name-based extraction takes priority; column heuristics are fallbacks.
 */
export function mapMondayItemToProjectWithRooms(item: MondayItem): MondayProjectWithRooms {
  const parsed = parseMondayItemName(item.name ?? "");
  const cols = item.column_values ?? [];
  const byTitle = (t: string) =>
    cols.find((c) => c.column?.title?.toLowerCase().includes(t))?.text?.trim() ?? null;

  const rooms = (item.subitems ?? []).map((sub) => ({
    label: sub.name?.trim() || "Room",
    type: guessRoomType(sub.name ?? ""),
  }));

  return {
    name: item.name?.trim() || "New project",
    jobNumber: parsed.jobNumber ?? byTitle("job") ?? byTitle("invoice") ?? byTitle("number") ?? null,
    clientName: parsed.clientName ?? byTitle("client") ?? byTitle("customer") ?? byTitle("name") ?? null,
    clientPhone: parsed.clientPhone,
    notes: byTitle("notes") ?? byTitle("description") ?? null,
    rooms,
  };
}

export type MondayFileAsset = {
  columnId: string;
  columnTitle: string | null;
  assetId: string;
  name: string;
  publicUrl: string | null;
  url: string | null;
  fileExtension: string | null;
  fileSize: number | null;
};

/**
 * Run a GraphQL query against Monday.com. Caller must pass apiKey (from config).
 */
export async function mondayGraphql(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
      "API-Version": MONDAY_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monday API HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

/**
 * Fetch file assets attached to an item across any "file" columns.
 * Uses Asset.public_url (temporary) when available.
 */
export async function fetchMondayItemFileAssets(apiKey: string, itemId: string): Promise<MondayFileAsset[]> {
  const data = await mondayGraphql(
    apiKey,
    `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        column_values {
          ... on FileValue {
            id
            column { title }
            files {
              ... on FileAssetValue {
                asset_id
                name
                asset {
                  public_url
                  url
                  file_extension
                  file_size
                }
              }
            }
          }
        }
      }
    }`,
    { itemIds: [itemId] }
  ) as any;

  const item = data?.items?.[0];
  const cols = item?.column_values ?? [];
  const out: MondayFileAsset[] = [];
  for (const cv of cols) {
    const files = cv?.files ?? [];
    for (const f of files) {
      out.push({
        columnId: String(cv?.id ?? ""),
        columnTitle: (cv?.column?.title as string | null) ?? null,
        assetId: String(f?.asset_id ?? ""),
        name: String(f?.name ?? ""),
        publicUrl: (f?.asset?.public_url as string | null) ?? null,
        url: (f?.asset?.url as string | null) ?? null,
        fileExtension: (f?.asset?.file_extension as string | null) ?? null,
        fileSize: (typeof f?.asset?.file_size === "number" ? f.asset.file_size : null) as number | null,
      });
    }
  }
  return out.filter((a) => a.assetId && a.name);
}

/**
 * List boards the API key can access.
 */
export async function fetchMondayBoards(apiKey: string): Promise<MondayBoard[]> {
  const data = await mondayGraphql(
    apiKey,
    `query { boards(limit: 50, state: active) { id name } }`
  ) as { boards?: { id: string | number; name: string }[] };
  const raw = data.boards ?? [];
  return raw.map((b) => ({ id: String(b.id), name: b.name }));
}

/**
 * List items on a board. Returns item id, name, column values, and subitems (e.g. Wood Shop subitems).
 */
export async function fetchMondayBoardItems(apiKey: string, boardId: string, limit = 50): Promise<MondayItem[]> {
  const data = await mondayGraphql(
    apiKey,
    `query ($boardId: ID!, $limit: Int!) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit) {
          items {
            id
            name
            column_values {
              id
              text
              value
              column {
                title
              }
            }
            subitems {
              id
              name
              column_values {
                id
                text
                value
                column {
                  title
                }
              }
            }
          }
        }
      }
    }`,
    { boardId, limit }
  ) as { boards?: { items_page?: { items: MondayItem[] } }[] };

  const board = data.boards?.[0];
  const page = board?.items_page;
  return page?.items ?? [];
}

const PAGE_LIMIT_FULL = 500;

/**
 * All top-level items on a board (with subitems), following items_page cursor until exhausted.
 * Use for AI listing and for resolving job# / name refs when the model did not pass numeric item IDs.
 */
export async function fetchAllMondayBoardItems(
  apiKey: string,
  boardId: string,
  maxPages = 50
): Promise<MondayItem[]> {
  let cursor: string | null = null;
  const out: MondayItem[] = [];

  for (let page = 0; page < maxPages; page++) {
    const query =
      cursor == null
        ? `query ($boardId: ID!, $limit: Int!) {
            boards(ids: [$boardId]) {
              items_page(limit: $limit) {
                cursor
                items {
                  id
                  name
                  column_values {
                    id
                    text
                    value
                    column { title }
                  }
                  subitems {
                    id
                    name
                    column_values {
                      id
                      text
                      value
                      column { title }
                    }
                  }
                }
              }
            }
          }`
        : `query ($nextCursor: String!) {
            next_items_page(cursor: $nextCursor) {
              cursor
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                  column { title }
                }
                subitems {
                  id
                  name
                  column_values {
                    id
                    text
                    value
                    column { title }
                  }
                }
              }
            }
          }`;

    const variables =
      cursor == null ? { boardId, limit: PAGE_LIMIT_FULL } : { nextCursor: cursor };

    const data = (await mondayGraphql(apiKey, query, variables)) as
      | { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }
      | { next_items_page?: { cursor?: string; items: MondayItem[] } };

    const pageData: { cursor?: string; items: MondayItem[] } | undefined = cursor == null
      ? (data as { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }).boards?.[0]?.items_page
      : (data as { next_items_page?: { cursor?: string; items: MondayItem[] } }).next_items_page;

    const items = pageData?.items ?? [];
    out.push(...items);
    cursor = pageData?.cursor ?? null;
    if (!cursor || items.length < PAGE_LIMIT_FULL) break;
  }

  return out;
}

/** Job / invoice / # column text for matching when the model passes MC-xxxx instead of item id. */
export function mondayJobColumnText(cols: MondayColumnValue[]): string | null {
  const j = cols.find((c) => /job|invoice|number|facture|#|n°/i.test(c.column?.title ?? ""));
  return j?.text?.trim() || null;
}

/**
 * Score how well a Monday row matches a user/model ref (often a job number or line prefix).
 * Used when itemId is not a raw Monday ID.
 */
export function scoreMondayRefMatch(name: string, jobText: string | null, refRaw: string): number {
  const ref = refRaw.trim();
  if (!ref) return 0;
  const nl = name.toLowerCase();
  const rl = ref.toLowerCase();
  const jt = jobText?.trim();
  const jl = jt?.toLowerCase() ?? "";

  if (jt && jl === rl) return 100;
  if (jt && (jl.includes(rl) || rl.includes(jl)) && jl.length >= 2 && rl.length >= 2) return 92;
  if (nl === rl) return 88;
  if (nl.startsWith(rl)) return 86;
  const mcRef = rl.match(/^(mc-?\d+)/i);
  if (mcRef && nl.startsWith(mcRef[1].toLowerCase())) return 84;
  if (nl.includes(rl) && rl.length >= 4) return 62;
  if (/^\d{3,}$/.test(rl) && (nl.includes(rl) || jl.includes(rl))) return 55;
  return 0;
}

function mapMondayItemToProjectFields(item: MondayItem): MondayItemForProject {
  const parsed = parseMondayItemName(item.name ?? "");
  const cols = item.column_values ?? [];
  const byTitle = (t: string) =>
    cols.find((c) => c.column?.title?.toLowerCase().includes(t))?.text?.trim() ?? null;
  return {
    name: item.name?.trim() || "New project",
    jobNumber: parsed.jobNumber ?? byTitle("job") ?? byTitle("invoice") ?? byTitle("number") ?? null,
    clientName: parsed.clientName ?? byTitle("client") ?? byTitle("customer") ?? byTitle("name") ?? null,
    clientPhone: parsed.clientPhone,
    notes: byTitle("notes") ?? byTitle("description") ?? null,
  };
}

/**
 * Find parent or subitem best matching ref (e.g. MC-6513 or a job column value).
 */
export function findMondayItemByRefInTree(items: MondayItem[], refRaw: string): MondayItem | null {
  const ref = refRaw.trim();
  if (!ref) return null;

  let best: { item: MondayItem; score: number } | null = null;
  const consider = (row: MondayItem) => {
    const cols = row.column_values ?? [];
    const job = mondayJobColumnText(cols);
    const s = scoreMondayRefMatch(row.name ?? "", job, ref);
    if (s > 0 && (!best || s > best.score)) {
      best = { item: row, score: s };
    }
  };

  for (const parent of items) {
    consider(parent);
    for (const sub of parent.subitems ?? []) {
      consider(sub as unknown as MondayItem);
    }
  }

  const result = best as { item: MondayItem; score: number } | null;
  return result && result.score >= 50 ? result.item : null;
}

/**
 * Fetch one item by ID and board, then map to project fields.
 * Monday's API no longer supports Board.items(ids); we use items_page and paginate until we find the item.
 * Uses heuristics: "Job" / "Invoice" column → jobNumber; "Client" / "Customer" → clientName; item name → name; "Notes" → notes.
 */
export async function getMondayItemAsProject(
  apiKey: string,
  boardId: string,
  itemId: string
): Promise<MondayItemForProject> {
  let cursor: string | null = null;
  const accumulated: MondayItem[] = [];

  for (let page = 0; page < 50; page++) {
    const query =
      cursor == null
        ? `query ($boardId: ID!, $limit: Int!) {
            boards(ids: [$boardId]) {
              items_page(limit: $limit) {
                cursor
                items {
                  id
                  name
                  column_values {
                    id
                    text
                    value
                    column { title }
                  }
                  subitems {
                    id
                    name
                    column_values {
                      id
                      text
                      value
                      column { title }
                    }
                  }
                }
              }
            }
          }`
        : `query ($nextCursor: String!) {
            next_items_page(cursor: $nextCursor) {
              cursor
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                  column { title }
                }
                subitems {
                  id
                  name
                  column_values {
                    id
                    text
                    value
                    column { title }
                  }
                }
              }
            }
          }`;

    const variables =
      cursor == null ? { boardId, limit: PAGE_LIMIT_FULL } : { nextCursor: cursor };

    const data = (await mondayGraphql(apiKey, query, variables)) as
      | { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }
      | { next_items_page?: { cursor?: string; items: MondayItem[] } };

    const pageData: { cursor?: string; items: MondayItem[] } | undefined = cursor == null
      ? (data as { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }).boards?.[0]?.items_page
      : (data as { next_items_page?: { cursor?: string; items: MondayItem[] } }).next_items_page;

    const items = pageData?.items ?? [];
    accumulated.push(...items);

    // Match top-level item
    let item = items.find((i) => String(i.id) === String(itemId)) ?? null;
    // If not found, match subitem (Wood Shop etc.)
    if (!item) {
      for (const parent of items) {
        const sub = parent.subitems?.find((s) => String(s.id) === String(itemId));
        if (sub) {
          item = sub as unknown as MondayItem;
          break;
        }
      }
    }

    if (item) {
      return mapMondayItemToProjectFields(item);
    }

    cursor = pageData?.cursor ?? null;
    if (!cursor || items.length < PAGE_LIMIT_FULL) break;
  }

  // Model often passes job labels (e.g. MC-6372) instead of numeric item IDs — resolve by name/job column.
  const byRef = findMondayItemByRefInTree(accumulated, itemId);
  if (byRef) {
    return mapMondayItemToProjectFields(byRef);
  }

  throw new Error("Monday item not found");
}
