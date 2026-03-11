/**
 * OpenAI function-calling definitions and their server-side executors.
 * Each function is something the AI can invoke to gather data or propose actions.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { fetchMondayBoardItems } from "@/lib/monday";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { buildEmailDraft } from "@/lib/purchasing/buildEmailDraft";
import { resolveDefaultSupplier } from "@/lib/purchasing/resolveDefaultSupplier";
import { findBorrowCandidates } from "@/lib/purchasing/borrowAnalysis";

export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getProjectStatus",
      description: "Get the full health status of a project including costs, material requirements, deviations, and orders.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "The project ID. Can also be a job number — will be resolved." },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getInventoryStatus",
      description: "Get inventory status for a specific material code or all materials. Shows onHand, reserved, available, and incoming quantities.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string", description: "Optional specific material code. If omitted, returns all items with alerts." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getShortages",
      description: "List all material shortages across projects, optionally filtered to a specific project.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Optional project ID to filter shortages for." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeOrder",
      description: "Propose creating a purchase order for materials. Returns a draft order summary for user confirmation. This is a QUEUED action — it will not execute until the user approves.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                materialCode: { type: "string" },
                quantity: { type: "number" },
              },
              required: ["materialCode", "quantity"],
            },
            description: "Materials to order.",
          },
          orderType: { type: "string", enum: ["order", "reserve"], description: "Whether to order or reserve." },
          projectRef: { type: "string", description: "Optional project reference (job# or name)." },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addMaterialToProject",
      description: "Add a material requirement to a project. This is a QUEUED action — requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID or job number." },
          materialCode: { type: "string", description: "Material code to add." },
          quantity: { type: "number", description: "Quantity required." },
        },
        required: ["projectId", "materialCode", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draftSupplierEmail",
      description: "Generate a prefilled email draft for ordering or reserving materials from a supplier.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string" },
          quantity: { type: "number" },
          orderType: { type: "string", enum: ["order", "reserve"] },
          projectRef: { type: "string", description: "Job# or client name for reference." },
        },
        required: ["materialCode", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "interpretNote",
      description: "Parse a messy or informal note into structured intent. Use this when the user's message seems like an informal instruction rather than a direct question.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The raw note text to interpret." },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findBorrowOptions",
      description: "Find projects that could lend allocated material to another project.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string" },
          borrowerProjectId: { type: "string" },
        },
        required: ["materialCode", "borrowerProjectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchProjects",
      description: "Search for projects by name, job number, or client name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listMondayItems",
      description: "List items on one or all configured Monday.com boards, including subitems (e.g. Wood Shop subitems under each parent item). Use when the user asks about Monday, new projects from Monday, Wood Shop subitems, or wants to import from Monday. If boardId is omitted, returns items from all saved boards. You can pass a board NAME (e.g. 'Wood Shop') to list only that board — the app resolves the name to the saved board ID. Subitems are listed under each parent with their IDs; you can use either parent or subitem IDs with createProjectsFromMondayItems.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "Optional. Monday board ID (numeric) or board name (e.g. 'Wood Shop'). If omitted, lists items from all configured boards." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createProjectFromMondayItem",
      description: "Propose creating a draft project in the app from a single Monday.com item or subitem (e.g. Wood Shop subitem). QUEUED — user must approve. Use createProjectsFromMondayItems when the user wants to create projects for multiple items.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "Monday board ID containing the item or subitem." },
          itemId: { type: "string", description: "Monday item ID or subitem ID (from listMondayItems)." },
        },
        required: ["boardId", "itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createProjectsFromMondayItems",
      description: "Propose creating draft projects for MULTIPLE Monday.com items or subitems in one step. REQUIRED when the user asks to create projects from Monday or confirms after you listed items. Call listMondayItems first to get item IDs (parent and subitem IDs in brackets e.g. [123], [456]), then call this with boardId and itemIds array. Subitem IDs (e.g. Wood Shop subitems) are supported. If you do not call this function, no Approve button appears and no projects are created. QUEUED — user approves once and all are created.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "Monday board ID (same for all items/subitems)." },
          itemIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of Monday item or subitem IDs to create projects for.",
          },
        },
        required: ["boardId", "itemIds"],
      },
    },
  },
];

/**
 * Execute a function call and return the result as a string.
 */
export async function executeFunctionCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; isAction?: boolean; actionPayload?: Record<string, unknown> }> {
  switch (name) {
    case "getProjectStatus":
      return { result: await handleGetProjectStatus(args.projectId as string) };

    case "getInventoryStatus":
      return { result: await handleGetInventoryStatus(args.materialCode as string | undefined) };

    case "getShortages":
      return { result: await handleGetShortages(args.projectId as string | undefined) };

    case "proposeOrder":
      return handleProposeOrder(args);

    case "addMaterialToProject":
      return handleAddMaterialToProject(args);

    case "draftSupplierEmail":
      return handleDraftSupplierEmail(args);

    case "interpretNote":
      return { result: `[Note interpretation is handled by the LLM itself. Raw text: "${args.text}"]` };

    case "findBorrowOptions":
      return { result: await handleFindBorrowOptions(args.materialCode as string, args.borrowerProjectId as string) };

    case "searchProjects":
      return { result: await handleSearchProjects(args.query as string) };

    case "listMondayItems":
      return { result: await handleListMondayItems(args.boardId as string | undefined) };

    case "createProjectFromMondayItem":
      return handleCreateProjectFromMondayItem(args);

    case "createProjectsFromMondayItems":
      return handleCreateProjectsFromMondayItems(args);

    default:
      return { result: `Unknown function: ${name}` };
  }
}

async function resolveProjectId(input: string): Promise<string | null> {
  // Try direct ID first
  const direct = await prisma.project.findUnique({ where: { id: input }, select: { id: true } });
  if (direct) return direct.id;

  // Try job number
  const byJob = await prisma.project.findFirst({ where: { jobNumber: input }, select: { id: true } });
  if (byJob) return byJob.id;

  // Fuzzy name search
  const byName = await prisma.project.findFirst({
    where: { name: { contains: input } },
    select: { id: true },
  });
  return byName?.id ?? null;
}

async function handleGetProjectStatus(projectIdOrRef: string): Promise<string> {
  const projectId = await resolveProjectId(projectIdOrRef);
  if (!projectId) return `Project not found: ${projectIdOrRef}`;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      costLines: true,
      projectSettings: true,
      materialRequirements: true,
      orders: { include: { lines: true, supplierRef: true } },
      deviations: { where: { resolved: false } },
    },
  });

  if (!project) return "Project not found";

  const est = project.costLines.filter((l) => l.kind === "estimate").reduce((s, l) => s + l.amount, 0);
  const act = project.costLines.filter((l) => l.kind === "actual").reduce((s, l) => s + l.amount, 0);
  const markup = project.projectSettings?.markup ?? 2.5;
  const recommended = est * markup;
  const margin = recommended > 0 ? ((recommended - act) / recommended) * 100 : 0;

  const lines = [
    `Project: ${project.name} (${project.jobNumber ?? "no job#"})`,
    `Type: ${project.types}`,
    `Status: ${project.isDraft ? "Draft" : project.isDone ? "Done" : "Active"}`,
    `Target: ${project.targetDate ? project.targetDate.toISOString().split("T")[0] : "Not set"}`,
    `Client: ${project.client ? `${project.client.firstName} ${project.client.lastName}` : "N/A"}`,
    `Estimate: $${est.toFixed(2)} | Actual: $${act.toFixed(2)} | Margin: ${margin.toFixed(1)}%`,
  ];

  if (project.materialRequirements.length > 0) {
    lines.push("\nMaterials:");
    for (const mr of project.materialRequirements) {
      lines.push(`  ${mr.materialCode}: need ${mr.requiredQty}, allocated ${mr.allocatedQty}`);
    }
  }

  if (project.deviations.length > 0) {
    lines.push("\nIssues:");
    for (const d of project.deviations) {
      lines.push(`  [${d.severity}] ${d.type}: ${d.message}`);
    }
  }

  if (project.orders.length > 0) {
    lines.push("\nOrders:");
    for (const o of project.orders) {
      lines.push(`  ${o.supplierRef?.name ?? o.supplier}: ${o.status} (${o.lines.length} lines)`);
    }
  }

  return lines.join("\n");
}

async function handleGetInventoryStatus(materialCode?: string): Promise<string> {
  const codes = materialCode ? [materialCode] : undefined;
  const state = await computeInventoryState(codes);

  if (state.length === 0) {
    return materialCode ? `No inventory item found for ${materialCode}` : "No inventory items found";
  }

  const items = await prisma.inventoryItem.findMany({
    where: codes ? { materialCode: { in: codes } } : undefined,
  });
  const itemMap = new Map(items.map((i) => [i.materialCode, i]));

  const lines = state.map((s) => {
    const item = itemMap.get(s.materialCode);
    const alerts = [];
    if (item && s.availableQty < (item.minThreshold ?? 0)) alerts.push("BELOW MIN");
    if (item && s.availableQty < (item.reorderPoint ?? 0)) alerts.push("NEEDS REORDER");
    return `${s.materialCode} (${item?.description ?? ""}): onHand=${s.onHand}, reserved=${s.reservedQty}, available=${s.availableQty}, incoming=${s.incomingQty}${alerts.length ? " ⚠ " + alerts.join(", ") : ""}`;
  });

  return lines.join("\n");
}

async function handleGetShortages(projectId?: string): Promise<string> {
  const where = projectId ? { projectId } : {};
  const reqs = await prisma.materialRequirement.findMany({
    where,
    include: { project: { select: { name: true, jobNumber: true } } },
  });

  const state = await computeInventoryState();
  const stateMap = new Map(state.map((s) => [s.materialCode, s]));

  const shortages = [];
  for (const req of reqs) {
    const inv = stateMap.get(req.materialCode);
    const available = inv?.availableQty ?? 0;
    const incoming = inv?.incomingQty ?? 0;
    if (req.requiredQty > available + incoming) {
      shortages.push(
        `${req.materialCode}: need ${req.requiredQty}, available ${available}, incoming ${incoming}, short ${req.requiredQty - available - incoming} — for ${req.project.jobNumber ?? req.project.name}`
      );
    }
  }

  return shortages.length > 0
    ? shortages.join("\n")
    : "No material shortages found";
}

function handleProposeOrder(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const items = args.items as { materialCode: string; quantity: number }[];
  const orderType = (args.orderType as string) ?? "order";
  const summary = items.map((i) => `${i.quantity}x ${i.materialCode}`).join(", ");

  return {
    result: `Proposed ${orderType}: ${summary}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "createOrder",
      orderType,
      items,
      projectRef: args.projectRef ?? null,
    },
  };
}

function handleAddMaterialToProject(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  return {
    result: `Proposed adding ${args.quantity}x ${args.materialCode} to project ${args.projectId}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "addMaterial",
      projectId: args.projectId,
      materialCode: args.materialCode,
      quantity: args.quantity,
    },
  };
}

async function handleDraftSupplierEmail(args: Record<string, unknown>): Promise<{
  result: string;
  isAction: true;
  actionPayload: Record<string, unknown>;
}> {
  const materialCode = args.materialCode as string;
  const quantity = args.quantity as number;
  const orderType = (args.orderType as string as "order" | "reserve") ?? "order";

  const item = await prisma.inventoryItem.findUnique({ where: { materialCode } });
  if (!item) return { result: `Material ${materialCode} not found`, isAction: true, actionPayload: {} };

  const supplier = await resolveDefaultSupplier(item.id);

  const email = buildEmailDraft({
    supplierEmail: supplier?.supplierEmail ?? null,
    supplierName: supplier?.supplierName ?? "Supplier",
    orderType,
    projectRef: (args.projectRef as string) ?? null,
    items: [{
      materialCode,
      description: item.description,
      quantity,
      unitCost: supplier?.unitCost ?? 0,
      supplierSku: supplier?.supplierSku ?? "",
    }],
    requestedDeliveryDate: null,
  });

  return {
    result: `Email draft ready for ${supplier?.supplierName ?? "supplier"}.\nSubject: ${email.subject}\n\n${email.body}`,
    isAction: true,
    actionPayload: {
      action: "openEmail",
      mailto: email.mailto,
      supplierName: supplier?.supplierName,
    },
  };
}

async function handleFindBorrowOptions(materialCode: string, borrowerProjectId: string): Promise<string> {
  const candidates = await findBorrowCandidates(materialCode, borrowerProjectId);
  if (candidates.length === 0) return "No borrow candidates found";

  return candidates.map((c) =>
    `${c.lenderJobNumber ?? c.lenderProjectName}: ${c.allocatedQty} allocated, ${c.weeksUntilTarget} weeks to target${c.hasTimeSlack ? " (has time slack)" : " (tight timeline)"}`
  ).join("\n");
}

async function handleSearchProjects(query: string): Promise<string> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { jobNumber: { contains: query } },
        { clientFirstName: { contains: query } },
        { clientLastName: { contains: query } },
      ],
    },
    select: {
      id: true,
      name: true,
      jobNumber: true,
      type: true,
      isDraft: true,
      isDone: true,
      clientFirstName: true,
      clientLastName: true,
    },
    take: 10,
  });

  if (projects.length === 0) return `No projects found matching "${query}"`;

  return projects.map((p) =>
    `${p.jobNumber ?? "?"} — ${p.name} (${p.type}) [${p.isDraft ? "Draft" : p.isDone ? "Done" : "Active"}]${p.clientFirstName ? ` Client: ${p.clientFirstName} ${p.clientLastName}` : ""} (id: ${p.id})`
  ).join("\n");
}

async function handleListMondayItems(boardId?: string): Promise<string> {
  const config = await getAppConfig();
  const apiKey = config.integrations?.mondayApiKey as string | undefined;
  if (!apiKey?.trim()) {
    return "Monday.com is not configured. Add an API key in Admin Hub → Integrations, then save.";
  }

  type BoardRef = { id: string; name?: string };
  const boardsConfig = config.integrations?.mondayBoards as BoardRef[] | undefined;
  const legacyId = (config.integrations?.mondayBoardId as string)?.trim();

  let boards: { id: string; name?: string }[];
  const allBoards = Array.isArray(boardsConfig) && boardsConfig.length > 0
    ? boardsConfig
    : legacyId
      ? [{ id: legacyId }]
      : [];

  if (boardId?.trim()) {
    const input = boardId.trim();
    const looksLikeNumericId = /^\d+$/.test(input);
    if (looksLikeNumericId) {
      boards = [{ id: input }];
    } else {
      const byName = allBoards.filter(
        (b) => b.name?.toLowerCase().includes(input.toLowerCase())
      );
      if (byName.length > 0) {
        boards = byName;
      } else {
        boards = [{ id: input }];
      }
    }
  } else if (allBoards.length > 0) {
    boards = allBoards;
  } else {
    return "No Monday boards configured. In Admin Hub → Integrations add one or more boards (Test connection, then Add).";
  }

  const apiKeyTrimmed = apiKey.trim();
  const sections: string[] = [];

  for (const board of boards) {
    try {
      const items = await fetchMondayBoardItems(apiKeyTrimmed, board.id, 25);
      const label = board.name ? `${board.name} (${board.id})` : board.id;
      if (items.length === 0) {
        sections.push(`Board ${label}: no items.`);
      } else {
        if (boards.length > 1) sections.push(`--- ${label} ---`);
        const allItemIds: string[] = [];
        const lines = items.flatMap((i) => {
          const job = i.column_values?.find((c) => /job|invoice|number/i.test(c.column?.title ?? ""))?.text;
          const client = i.column_values?.find((c) => /client|customer/i.test(c.column?.title ?? ""))?.text;
          const status = i.column_values?.find((c) => /status|état|state/i.test(c.column?.title ?? ""))?.text;
          allItemIds.push(String(i.id));
          const parentLine = `[${i.id}] ${i.name}${job ? ` | Job: ${job}` : ""}${client ? ` | Client: ${client}` : ""}${status ? ` | Status: ${status}` : ""}`;
          const subitems = i.subitems ?? [];
          if (subitems.length === 0) return [parentLine];
          const subLines = subitems.map((s) => {
            const subStatus = s.column_values?.find((c) => /status|état|state/i.test(c.column?.title ?? ""))?.text;
            allItemIds.push(String(s.id));
            return `  └ [${s.id}] ${s.name}${subStatus ? ` | Status: ${subStatus}` : ""}`;
          });
          return [parentLine, ...subLines];
        });
        sections.push(lines.join("\n"));
        sections.push(`(Board ID: ${board.id}. Item IDs for createProjectsFromMondayItems (parents and subitems): ${allItemIds.map((id) => `"${id}"`).join(", ")}.)`);
      }
    } catch (err) {
      sections.push(`Board ${board.name ?? board.id}: error — ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return sections.join("\n\n");
}

function handleCreateProjectFromMondayItem(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const boardId = args.boardId as string;
  const itemId = args.itemId as string;
  return {
    result: `Proposed creating a draft project from Monday item ${itemId} on board ${boardId}. Awaiting your approval.`,
    isAction: true,
    actionPayload: {
      action: "createProjectFromMonday",
      boardId,
      itemId,
    },
  };
}

function handleCreateProjectsFromMondayItems(
  args: Record<string, unknown>
): { result: string; isAction: boolean; actionPayload?: Record<string, unknown> } {
  const boardId = args.boardId as string;
  const raw = args.itemIds;
  const itemIds = Array.isArray(raw) ? (raw as string[]).filter((id) => typeof id === "string" && id.trim()) : [];
  const items = itemIds.map((itemId) => ({ boardId, itemId }));
  const count = items.length;

  if (count === 0) {
    return {
      result: `No item IDs provided. You must call listMondayItems first to get the list (each line has an id in brackets like [123456]). Then call createProjectsFromMondayItems again with boardId and itemIds set to an array of those ID strings (e.g. ["123456", "789012"]).`,
      isAction: false,
    };
  }

  return {
    result: `Proposed creating ${count} draft project(s) from Monday items on board ${boardId}. Awaiting your approval.`,
    isAction: true,
    actionPayload:
      count === 1
        ? { action: "createProjectFromMonday", boardId, itemId: items[0].itemId }
        : { action: "createProjectFromMonday", items },
  };
}
