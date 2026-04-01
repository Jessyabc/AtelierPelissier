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
  notes: string | null;
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
  const PAGE_LIMIT = 500;
  let cursor: string | null = null;

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
      cursor == null ? { boardId, limit: PAGE_LIMIT } : { nextCursor: cursor };

    const data = (await mondayGraphql(apiKey, query, variables)) as
      | { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }
      | { next_items_page?: { cursor?: string; items: MondayItem[] } };

    const pageData: { cursor?: string; items: MondayItem[] } | undefined = cursor == null
      ? (data as { boards?: { items_page?: { cursor?: string; items: MondayItem[] } }[] }).boards?.[0]?.items_page
      : (data as { next_items_page?: { cursor?: string; items: MondayItem[] } }).next_items_page;

    const items = pageData?.items ?? [];

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
      const cols = item.column_values ?? [];
      const byTitle = (t: string) =>
        cols.find((c) => c.column?.title?.toLowerCase().includes(t))?.text?.trim() ?? null;
      return {
        name: item.name?.trim() || "New project",
        jobNumber: byTitle("job") ?? byTitle("invoice") ?? byTitle("number") ?? null,
        clientName: byTitle("client") ?? byTitle("customer") ?? byTitle("name") ?? null,
        notes: byTitle("notes") ?? byTitle("description") ?? null,
      };
    }

    cursor = pageData?.cursor ?? null;
    if (!cursor || items.length < PAGE_LIMIT) break;
  }

  throw new Error("Monday item not found");
}
