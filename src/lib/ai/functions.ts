/**
 * OpenAI function-calling definitions and their server-side executors.
 * Each function is something the AI can invoke to gather data or propose actions.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { fetchAllMondayBoardItems, parseMondayItemName, guessRoomType } from "@/lib/monday";
import { computeInventoryState } from "@/lib/observability/recalculateInventoryState";
import { buildEmailDraft } from "@/lib/purchasing/buildEmailDraft";
import { resolveDefaultSupplier } from "@/lib/purchasing/resolveDefaultSupplier";
import { findBorrowCandidates } from "@/lib/purchasing/borrowAnalysis";
import { blockedReasonLabel, blockedReasonSeverityRank } from "@/lib/blockedReasonLabels";

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
      name: "listWarehouseSections",
      description: "List warehouse sections/areas used to track where inventory is stored (e.g. Sheet goods, Hardware wall).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeCreateWarehouseSection",
      description:
        "Propose creating a new warehouse section/area for inventory locations. QUEUED — requires user approval.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Section name (e.g. 'Sheet goods', 'Quincaillerie')." },
          description: { type: "string", description: "Optional description (e.g. 'Back wall racks')." },
          sortOrder: { type: "number", description: "Optional sort order (smaller = earlier)." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeSetInventoryLocation",
      description:
        "Propose setting the warehouse location for an inventory item by material code. QUEUED — requires user approval.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string", description: "Exact material code (e.g. 'MEL-WHT-3/4-4x8')." },
          section: { type: "string", description: "Warehouse section name or ID. Example: 'Sheet goods'." },
          locationNote: { type: "string", description: "Optional detail (e.g. 'Aisle 2 / Rack B / Shelf 3')." },
        },
        required: ["materialCode", "section"],
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
      name: "getBlockedProjects",
      description:
        "List all non-done projects that are marked blocked (blockedReason set), grouped by reason. Use when the user asks what is blocked, what cannot ship, or operations holdups.",
      parameters: { type: "object", properties: {} },
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
      description: "Search for projects by name, job number, or client name. Use this FIRST when the user asks for feedback, status, or info about a project by client name (e.g. 'Karine Allard') or invoice/job number — then call getProjectStatus with the returned project id. Do not use listMondayItems for client names.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (client name, job number, invoice number, or project name)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listMondayItems",
      description: "List items on configured Monday.com boards only. Use ONLY when the user explicitly asks about Monday.com, a Monday board, or importing from Monday. For 'feedback on [client name]' or 'status for [invoice#]' use searchProjects then getProjectStatus instead. If boardId is omitted, returns items from all saved boards. Pass a configured board NAME (e.g. 'Wood Shop') to list only that board — client names are not board names.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "Optional. Monday board ID (numeric) or a configured board name (e.g. 'Wood Shop'). Not for client names." },
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
          itemId: {
            type: "string",
            description:
              "Numeric Monday item or subitem ID from listMondayItems (shown in brackets, e.g. [1234567890]). Prefer that over job numbers like MC-xxxx.",
          },
        },
        required: ["boardId", "itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchInventory",
      description: "Search inventory items by name, description, or partial material code. Use this to resolve a product name (e.g. 'white melamine', 'birch', 'drawer slides') to its material code before calling receiveInventory or other functions that require a materialCode.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Partial name, description, or material code to search for." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "receiveInventory",
      description: "Propose adding stock to an existing inventory item (e.g. when a delivery arrives). QUEUED — requires user approval. If you don't know the exact materialCode, call searchInventory first to find it.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string", description: "Exact material code of the inventory item." },
          quantity: { type: "number", description: "Quantity received (positive number)." },
          note: { type: "string", description: "Optional note (e.g. supplier name, invoice number, date)." },
          orderId: { type: "string", description: "Optional order ID if receiving against a specific order." },
        },
        required: ["materialCode", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createInventoryItem",
      description: "Propose creating a new inventory item (product) that doesn't exist yet. QUEUED — requires user approval. Use this when the user wants to add a new product that isn't in the system.",
      parameters: {
        type: "object",
        properties: {
          materialCode: { type: "string", description: "Unique material code (e.g. MEL-WHT-3/4-4x8). Concise, uppercase." },
          description: { type: "string", description: "Human-readable description (e.g. 'White Melamine 3/4\" 4x8')." },
          unit: { type: "string", description: "Unit of measure (sheets, pieces, feet, boxes). Default: sheets." },
          onHand: { type: "number", description: "Initial quantity on hand. Default: 0." },
          category: { type: "string", enum: ["sheetGoods", "hardware", "finish", "delivery", "outsourced", "labor", "misc"], description: "Product category." },
          minThreshold: { type: "number", description: "Minimum stock alert threshold. Default: 0." },
        },
        required: ["materialCode", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateProjectStatus",
      description: "Propose changing a project's status: activate a draft, mark as done, or reopen. QUEUED — requires user approval.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID or job number." },
          status: { type: "string", enum: ["active", "done", "draft"], description: "New status: 'active' (start production), 'done' (completed/delivered), 'draft' (reopen as draft)." },
        },
        required: ["projectId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "receiveOrder",
      description: "Propose marking an order as received and updating inventory quantities. QUEUED — requires user approval. Use when a delivery arrives against an existing order. Call getProjectStatus or getInventoryStatus first to find the orderId if needed.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The order ID to receive." },
          lines: {
            type: "array",
            description: "Optional: specific lines to receive. If omitted, all lines are received at their ordered quantity.",
            items: {
              type: "object",
              properties: {
                orderLineId: { type: "string" },
                receivedQty: { type: "number" },
              },
              required: ["orderLineId", "receivedQty"],
            },
          },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createProjectsFromMondayItems",
      description:
        "Propose creating draft projects from Monday.com PARENT items. Each parent item becomes one project; its subitems automatically become rooms (ProjectItems) inside that project. Call listMondayItems first, then pass boardId and ONLY the parent item IDs in brackets — never pass subitem IDs. The server extracts MC-xxxx job numbers and client names from item names, and creates rooms from subitems. QUEUED — user approves once and all are created.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "Monday board ID (same for all items/subitems)." },
          itemIds: {
            type: "array",
            items: { type: "string" },
            description:
              "PARENT item IDs only (brackets on each line from listMondayItems). Do NOT include subitem IDs — subitems become rooms automatically. Prefer numeric IDs; MC-xxxx may resolve server-side.",
          },
        },
        required: ["boardId", "itemIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeScheduleServiceCall",
      description:
        "Propose scheduling a field service visit for a project: creates a ServiceCall and adds it to the day plan / calendar. QUEUED — user must approve. Use searchProjects first if the project is unclear. Requires serviceDate as YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID, job number (e.g. MC-6199), or distinctive project name fragment." },
          serviceDate: { type: "string", description: "Date of the visit in YYYY-MM-DD (local shop date)." },
          serviceTime: { type: "string", description: "Optional time HH:MM (24h) for arrival." },
          reasonForService: { type: "string", description: "Short reason (install, warranty, measure, etc.)." },
          notes: { type: "string", description: "Internal notes for the crew." },
          technicianName: { type: "string", description: "Who is going (optional)." },
        },
        required: ["projectId", "serviceDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeCreateDraftProjectAndServiceCall",
      description:
        "Propose creating a NEW draft project (if none exists) and a linked service call draft from a messy message (SMS/email). Use when the user asks to add a service call but no project exists yet. Date/address are optional; if no date, it won't appear on the calendar/day plan until scheduled later. QUEUED — user must approve.",
      parameters: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "Short name for the draft project (e.g. 'Roman — Service call', 'Jessy — missing handles').",
          },
          clientName: { type: "string", description: "Client full name (best-effort)." },
          clientEmail: { type: "string", description: "Optional client email." },
          clientPhone: { type: "string", description: "Optional client phone." },
          clientAddress: { type: "string", description: "Optional full address." },
          serviceDate: { type: "string", description: "Optional YYYY-MM-DD. If omitted, service call remains unscheduled." },
          serviceTime: { type: "string", description: "Optional HH:MM (24h) time for arrival." },
          technicianName: { type: "string", description: "Optional technician name." },
          serviceCallType: {
            type: "array",
            items: { type: "string" },
            description: "Optional service call types (e.g. warranty, repair, adjustment, inspection, installation, measurements, other).",
          },
          reasonForService: { type: "string", description: "Optional short reason." },
          notes: { type: "string", description: "Optional internal notes (pickup at shop, bring hardware, etc.)." },
          workItems: {
            type: "array",
            description: "List of work items / issues to fix (what needs to be done).",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "string" },
                providedBy: { type: "string", description: "Optional: company | client" },
              },
              required: ["description"],
            },
          },
          rawMessage: { type: "string", description: "Original raw text for traceability (optional but recommended)." },
        },
        required: ["clientName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDaySchedule",
      description:
        "Get the shop's schedule for a specific date (service calls + manual calendar events), ordered for route planning. Use this to answer questions like 'what's tomorrow?' or 'what's on Friday?'.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD (local shop date)." },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getScheduleRange",
      description:
        "Get schedule events for a date range (inclusive), grouped by day. Use this for 'this week', 'next 7 days', or planning over multiple days.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD (inclusive)." },
          endDate: { type: "string", description: "End date YYYY-MM-DD (inclusive)." },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getServiceCallDetails",
      description:
        "Get full details for a service call: work items (checklist lines from the Service Call tab), types, technician, address, etc. Pass serviceCallId from getDaySchedule/getScheduleRange JSON (field serviceCallId). If the user only names a job (e.g. MC-6595), pass projectRef instead (job number or project name). Optional serviceDate (YYYY-MM-DD) narrows when a project has multiple visits.",
      parameters: {
        type: "object",
        properties: {
          serviceCallId: {
            type: "string",
            description: "Exact ServiceCall id (cuid) from schedule tool output. Do not pass a job number here unless you already tried projectRef.",
          },
          projectRef: {
            type: "string",
            description: "Project id, job number (e.g. MC-6595), or distinctive project name when you do not have serviceCallId.",
          },
          serviceDate: {
            type: "string",
            description: "Optional YYYY-MM-DD to select the visit on that day.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listEmployees",
      description: "List team members (employees). Optionally filter by role: salesperson, woodworker, planner, or admin.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["salesperson", "woodworker", "admin", "planner"], description: "Optional role filter." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getActivePunches",
      description: "Get all employees currently clocked in — who is on the shop floor right now, at which station, and on which job.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getLaborHours",
      description: "Get labor hours logged, optionally filtered by project or employee. Returns total hours and a breakdown by employee and station.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Optional project ID or job number to filter by." },
          employeeId: { type: "string", description: "Optional employee ID to filter by." },
        },
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

    case "listWarehouseSections":
      return { result: await handleListWarehouseSections() };

    case "proposeCreateWarehouseSection":
      return handleProposeCreateWarehouseSection(args);

    case "proposeSetInventoryLocation":
      return handleProposeSetInventoryLocation(args);

    case "getShortages":
      return { result: await handleGetShortages(args.projectId as string | undefined) };

    case "getBlockedProjects":
      return { result: await handleGetBlockedProjects() };

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

    case "searchInventory":
      return { result: await handleSearchInventory(args.query as string) };

    case "receiveInventory":
      return handleReceiveInventory(args);

    case "createInventoryItem":
      return handleCreateInventoryItem(args);

    case "updateProjectStatus":
      return handleUpdateProjectStatus(args);

    case "receiveOrder":
      return handleReceiveOrder(args);

    case "proposeScheduleServiceCall":
      return handleProposeScheduleServiceCall(args);

    case "proposeCreateDraftProjectAndServiceCall":
      return handleProposeCreateDraftProjectAndServiceCall(args);

    case "getDaySchedule":
      return { result: await handleGetDaySchedule(args.date as string) };

    case "getScheduleRange":
      return { result: await handleGetScheduleRange(args.startDate as string, args.endDate as string) };

    case "getServiceCallDetails":
      return {
        result: await handleGetServiceCallDetails({
          serviceCallId: args.serviceCallId as string | undefined,
          projectRef: args.projectRef as string | undefined,
          serviceDate: args.serviceDate as string | undefined,
        }),
      };

    case "listEmployees":
      return { result: await handleListEmployees(args.role as string | undefined) };

    case "getActivePunches":
      return { result: await handleGetActivePunches() };

    case "getLaborHours":
      return { result: await handleGetLaborHours(args.projectId as string | undefined, args.employeeId as string | undefined) };

    default:
      return { result: `Unknown function: ${name}` };
  }
}

function parseYmdToLocalDayBounds(dateParam: string): { dayStart: Date; dayEnd: Date } | null {
  const [y, m, d] = dateParam.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dayStart = new Date(y, m - 1, d);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { dayStart, dayEnd };
}

type ScheduleEvent = {
  type: "service_call" | "manual";
  time: string;
  title: string;
  address?: string | null;
  jobNumber?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  serviceCallId?: string | null;
  notes?: string | null;
};

async function handleGetDaySchedule(dateParam: string): Promise<string> {
  if (!dateParam) return JSON.stringify({ error: "date required (YYYY-MM-DD)" });
  const bounds = parseYmdToLocalDayBounds(dateParam);
  if (!bounds) return JSON.stringify({ error: "invalid date format; expected YYYY-MM-DD" });

  const { dayStart, dayEnd } = bounds;

  const [serviceCalls, manualEvents] = await Promise.all([
    prisma.serviceCall.findMany({
      where: { serviceDate: { gte: dayStart, lte: dayEnd } },
      include: { project: { select: { id: true, jobNumber: true, clientFirstName: true, clientLastName: true } } },
      orderBy: { timeOfArrival: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { eventDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ scheduledTime: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const events: ScheduleEvent[] = [];

  for (const sc of serviceCalls) {
    const time = sc.timeOfArrival ? new Date(sc.timeOfArrival).toTimeString().slice(0, 5) : "";
    const clientName =
      sc.clientName ??
      ([sc.project?.clientFirstName, sc.project?.clientLastName].filter(Boolean).join(" ") || null);
    events.push({
      type: "service_call",
      time,
      title: sc.serviceCallNumber ?? sc.jobNumber ?? sc.clientName ?? "Service call",
      address: sc.address,
      jobNumber: sc.jobNumber ?? sc.project?.jobNumber ?? null,
      clientName,
      projectId: sc.projectId ?? null,
      serviceCallId: sc.id,
    });
  }

  for (const ev of manualEvents) {
    events.push({
      type: "manual",
      time: ev.scheduledTime ?? "",
      title: ev.title,
      address: ev.address,
      notes: ev.notes,
    });
  }

  events.sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));

  return JSON.stringify({ date: dateParam, events }, null, 2);
}

async function handleGetScheduleRange(startDate: string, endDate: string): Promise<string> {
  if (!startDate || !endDate) return JSON.stringify({ error: "startDate and endDate required (YYYY-MM-DD)" });

  const startBounds = parseYmdToLocalDayBounds(startDate);
  const endBounds = parseYmdToLocalDayBounds(endDate);
  if (!startBounds || !endBounds) return JSON.stringify({ error: "invalid date format; expected YYYY-MM-DD" });

  const rangeStart = startBounds.dayStart;
  const rangeEnd = endBounds.dayEnd;

  const [serviceCalls, manualEvents] = await Promise.all([
    prisma.serviceCall.findMany({
      where: { serviceDate: { gte: rangeStart, lte: rangeEnd } },
      include: { project: { select: { id: true, jobNumber: true, clientFirstName: true, clientLastName: true } } },
      orderBy: [{ serviceDate: "asc" }, { timeOfArrival: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: { eventDate: { gte: rangeStart, lte: rangeEnd } },
      orderBy: [{ eventDate: "asc" }, { scheduledTime: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const grouped: Record<string, ScheduleEvent[]> = {};
  const ensure = (date: string) => (grouped[date] ??= []);

  for (const sc of serviceCalls) {
    if (!sc.serviceDate) continue;
    const date = sc.serviceDate.toISOString().slice(0, 10);
    const time = sc.timeOfArrival ? new Date(sc.timeOfArrival).toTimeString().slice(0, 5) : "";
    const clientName =
      sc.clientName ??
      ([sc.project?.clientFirstName, sc.project?.clientLastName].filter(Boolean).join(" ") || null);
    ensure(date).push({
      type: "service_call",
      time,
      title: sc.serviceCallNumber ?? sc.jobNumber ?? sc.clientName ?? "Service call",
      address: sc.address,
      jobNumber: sc.jobNumber ?? sc.project?.jobNumber ?? null,
      clientName,
      projectId: sc.projectId ?? null,
      serviceCallId: sc.id,
    });
  }

  for (const ev of manualEvents) {
    const date = ev.eventDate.toISOString().slice(0, 10);
    ensure(date).push({
      type: "manual",
      time: ev.scheduledTime ?? "",
      title: ev.title,
      address: ev.address,
      notes: ev.notes,
    });
  }

  for (const day of Object.keys(grouped)) {
    grouped[day].sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));
  }

  return JSON.stringify({ startDate, endDate, days: grouped }, null, 2);
}

export async function resolveProjectId(input: string): Promise<string | null> {
  // Try direct ID first
  const direct = await prisma.project.findUnique({ where: { id: input }, select: { id: true } });
  if (direct) return direct.id;

  const trimmed = input.trim();

  // Try job number
  const byJob = await prisma.project.findFirst({ where: { jobNumber: trimmed }, select: { id: true } });
  if (byJob) return byJob.id;

  // If user passed a composite ref (e.g. "MC-6769 & MC-6199"), try extracting plausible job tokens.
  const jobTokens = Array.from(trimmed.matchAll(/[A-Z]{1,4}-\d{3,8}/g)).map((m) => m[0]);
  for (const token of jobTokens) {
    const byToken = await prisma.project.findFirst({ where: { jobNumber: token }, select: { id: true } });
    if (byToken) return byToken.id;
  }

  // Fuzzy name search
  const byName = await prisma.project.findFirst({
    where: { name: { contains: trimmed } },
    select: { id: true },
  });
  return byName?.id ?? null;
}

function formatServiceCallPayload(sc: {
  id: string;
  serviceCallNumber: string | null;
  jobNumber: string | null;
  clientName: string | null;
  address: string | null;
  serviceDate: Date | null;
  timeOfArrival: Date | null;
  technicianName: string | null;
  serviceCallType: string | null;
  reasonForService: string | null;
  notes: string | null;
  checklistJson: string | null;
  project: { id: string; name: string; jobNumber: string | null };
  items: { id: string; description: string; quantity: string | null; providedBy: string | null; files: { id: string; fileName: string; storagePath: string }[] }[];
}) {
  let serviceCallType: unknown = sc.serviceCallType;
  try {
    if (typeof sc.serviceCallType === "string" && sc.serviceCallType.trim().startsWith("[")) {
      serviceCallType = JSON.parse(sc.serviceCallType);
    }
  } catch {
    // keep raw string
  }

  const workItems = sc.items.map((it) => ({
    id: it.id,
    description: it.description,
    quantity: it.quantity,
    providedBy: it.providedBy,
    files: it.files.map((f) => ({ id: f.id, fileName: f.fileName, storagePath: f.storagePath })),
  }));

  return {
    id: sc.id,
    project: sc.project,
    serviceCallNumber: sc.serviceCallNumber,
    jobNumber: sc.jobNumber,
    clientName: sc.clientName,
    address: sc.address,
    serviceDate: sc.serviceDate?.toISOString() ?? null,
    timeOfArrival: sc.timeOfArrival?.toISOString() ?? null,
    technicianName: sc.technicianName,
    serviceCallType,
    reasonForService: sc.reasonForService,
    notes: sc.notes,
    checklistJson: sc.checklistJson,
    workItems,
  };
}

const serviceCallInclude = {
  project: { select: { id: true, name: true, jobNumber: true } as const },
  items: { include: { files: true as const } },
} as const;

async function handleGetServiceCallDetails(params: {
  serviceCallId?: string;
  projectRef?: string;
  serviceDate?: string;
}): Promise<string> {
  const idTrim = params.serviceCallId?.trim();
  const refTrim = params.projectRef?.trim();
  const dateTrim = params.serviceDate?.trim();

  if (!idTrim && !refTrim) {
    return JSON.stringify({
      error: "Provide serviceCallId (from schedule JSON) or projectRef (job number / project id / name).",
    });
  }

  const includeClause = serviceCallInclude;

  if (idTrim) {
    const byId = await prisma.serviceCall.findUnique({
      where: { id: idTrim },
      include: includeClause,
    });
    if (byId) return JSON.stringify(formatServiceCallPayload(byId), null, 2);

    // Model often mistakenly passes MC-6595 as serviceCallId — resolve as project and load calls.
    const mistakenProjectId = await resolveProjectId(idTrim);
    if (mistakenProjectId) {
      const dateBounds = dateTrim ? parseYmdToLocalDayBounds(dateTrim) : null;
      const calls = await prisma.serviceCall.findMany({
        where: {
          projectId: mistakenProjectId,
          ...(dateBounds ? { serviceDate: { gte: dateBounds.dayStart, lte: dateBounds.dayEnd } } : {}),
        },
        include: includeClause,
        orderBy: [{ serviceDate: "desc" }, { id: "desc" }],
      });
      if (calls.length === 0) {
        return JSON.stringify({
          error: "No service calls found for this project/job",
          triedAs: "projectRef derived from serviceCallId argument",
          projectId: mistakenProjectId,
          serviceDateFilter: dateTrim ?? null,
        });
      }
      if (calls.length === 1) return JSON.stringify(formatServiceCallPayload(calls[0]), null, 2);
      return JSON.stringify(
        {
          multiple: true,
          count: calls.length,
          message: "Multiple service calls for this project; pass serviceCallId for one, or narrow with serviceDate.",
          serviceCalls: calls.map((c) => formatServiceCallPayload(c)),
        },
        null,
        2
      );
    }

    return JSON.stringify({ error: "Service call not found for id", serviceCallId: idTrim });
  }

  const projectId = await resolveProjectId(refTrim!);
  if (!projectId) {
    return JSON.stringify({ error: "Project not found", projectRef: refTrim });
  }

  const dateBounds = dateTrim ? parseYmdToLocalDayBounds(dateTrim) : null;
  const calls = await prisma.serviceCall.findMany({
    where: {
      projectId,
      ...(dateBounds ? { serviceDate: { gte: dateBounds.dayStart, lte: dateBounds.dayEnd } } : {}),
    },
    include: includeClause,
    orderBy: [{ serviceDate: "desc" }, { id: "desc" }],
  });

  if (calls.length === 0) {
    return JSON.stringify({
      error: "No service calls found for this project",
      projectId,
      projectRef: refTrim,
      serviceDateFilter: dateTrim ?? null,
      hint: "Create the visit in the project Service Call tab or schedule it — then work items will appear here.",
    });
  }

  if (calls.length === 1) return JSON.stringify(formatServiceCallPayload(calls[0]), null, 2);

  return JSON.stringify(
    {
      multiple: true,
      count: calls.length,
      message: "Multiple service calls; use serviceCallId from this list or pass serviceDate to narrow.",
      serviceCalls: calls.map((c) => formatServiceCallPayload(c)),
    },
    null,
    2
  );
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

async function handleGetBlockedProjects(): Promise<string> {
  const rows = await prisma.project.findMany({
    where: { isDone: false, blockedReason: { not: null } },
    select: {
      id: true,
      name: true,
      jobNumber: true,
      blockedReason: true,
      isDraft: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (rows.length === 0) {
    return "No blocked projects (blockedReason is empty for all active projects).";
  }

  const sorted = [...rows].sort(
    (a, b) =>
      blockedReasonSeverityRank(a.blockedReason!) - blockedReasonSeverityRank(b.blockedReason!)
  );

  const byReason = new Map<string, typeof sorted>();
  for (const r of sorted) {
    const key = r.blockedReason ?? "";
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key)!.push(r);
  }

  const lines: string[] = [];
  for (const [reason, list] of [...byReason.entries()].sort(
    (a, b) => blockedReasonSeverityRank(a[0]) - blockedReasonSeverityRank(b[0])
  )) {
    lines.push(`## ${blockedReasonLabel(reason)} (${list.length})`);
    for (const p of list) {
      const ref = p.jobNumber ?? p.name;
      const draft = p.isDraft ? " [draft]" : "";
      lines.push(`- ${ref}${draft} — /projects/${p.id}`);
    }
  }

  return lines.join("\n");
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

async function handleProposeScheduleServiceCall(
  args: Record<string, unknown>
): Promise<{ result: string; isAction: true; actionPayload: Record<string, unknown> } | { result: string }> {
  const projectRef = args.projectId as string;
  const serviceDate = String(args.serviceDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return { result: "serviceDate must be YYYY-MM-DD." };
  }
  const resolved = await resolveProjectId(projectRef);
  if (!resolved) {
    return { result: `Project not found: ${projectRef}. Call searchProjects first.` };
  }

  const time = args.serviceTime ? String(args.serviceTime).trim() : "";
  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    return { result: "serviceTime must be HH:MM (24h) or omit." };
  }

  const summaryBits = [`Project ${resolved}`, `date ${serviceDate}`];
  if (time) summaryBits.push(`time ${time}`);
  return {
    result: `Proposed service call: ${summaryBits.join(", ")}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "scheduleServiceCall",
      projectId: resolved,
      serviceDate,
      serviceTime: time || undefined,
      reasonForService: args.reasonForService ?? undefined,
      notes: args.notes ?? undefined,
      technicianName: args.technicianName ?? undefined,
    },
  };
}

function normalizeServiceType(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        // fallthrough
      }
    }
    return s.split(/[,;/]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [String(raw).trim()].filter(Boolean);
}

function handleProposeCreateDraftProjectAndServiceCall(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } | { result: string } {
  const clientName = String(args.clientName ?? "").trim();
  if (!clientName) return { result: "clientName is required." };

  const serviceDate = String(args.serviceDate ?? "").trim();
  if (serviceDate && !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return { result: "serviceDate must be YYYY-MM-DD if provided." };
  }
  const serviceTime = String(args.serviceTime ?? "").trim();
  if (serviceTime && !/^\d{1,2}:\d{2}$/.test(serviceTime)) {
    return { result: "serviceTime must be HH:MM (24h) if provided." };
  }

  const projectName = String(args.projectName ?? "").trim() || `${clientName} — Service call`;
  const workItemsRaw = (args.workItems as unknown) ?? [];
  const workItems = Array.isArray(workItemsRaw)
    ? workItemsRaw
        .map((it) => it as Record<string, unknown>)
        .map((it) => ({
          description: String(it.description ?? "").trim(),
          quantity: it.quantity != null ? String(it.quantity).trim() : null,
          providedBy: it.providedBy != null ? String(it.providedBy).trim() : null,
        }))
        .filter((it) => it.description)
    : [];

  return {
    result:
      `Proposed: create a new draft project (“${projectName}”) and a service call draft for ${clientName}` +
      (serviceDate ? ` on ${serviceDate}` : " (unscheduled)") +
      (workItems.length ? ` with ${workItems.length} work item(s)` : "") +
      ". Awaiting user approval.",
    isAction: true,
    actionPayload: {
      action: "createDraftProjectAndServiceCall",
      projectName,
      clientName,
      clientEmail: args.clientEmail ?? null,
      clientPhone: args.clientPhone ?? null,
      clientAddress: args.clientAddress ?? null,
      serviceDate: serviceDate || null,
      serviceTime: serviceTime || null,
      technicianName: args.technicianName ?? null,
      serviceCallType: normalizeServiceType(args.serviceCallType),
      reasonForService: args.reasonForService ?? null,
      notes: args.notes ?? null,
      workItems,
      rawMessage: args.rawMessage ?? null,
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
        // Input looks like a board name but no configured board matches (e.g. user passed a client name like "Karine Allard").
        return `No Monday board is configured with the name "${input}". Configured board names are: ${allBoards.map((b) => b.name || b.id).filter(Boolean).join(", ") || "(none — only IDs)"}. If you meant a client or project, use searchProjects with the client name or invoice number, then getProjectStatus with the project id.`;
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
      const items = await fetchAllMondayBoardItems(apiKeyTrimmed, board.id);
      const label = board.name ? `${board.name} (${board.id})` : board.id;
      if (items.length === 0) {
        sections.push(`Board ${label}: no items.`);
      } else {
        if (boards.length > 1) sections.push(`--- ${label} ---`);
        // Parent items = projects; subitems = rooms within that project.
        // Only parent IDs should be passed to createProjectsFromMondayItems.
        const parentIds: string[] = [];
        const lines = items.map((i) => {
          const parsed = parseMondayItemName(i.name ?? "");
          const status = i.column_values?.find((c) => /status|état|state/i.test(c.column?.title ?? ""))?.text;
          const group = i.column_values?.find((c) => /group/i.test(c.column?.title ?? ""))?.text;
          parentIds.push(String(i.id));
          const subitems = i.subitems ?? [];
          const roomList = subitems.length > 0
            ? ` | ${subitems.length} room(s): ${subitems.map((s) => s.name?.trim() || "?").join(", ")}`
            : "";
          return `[${i.id}] ${i.name}${parsed.jobNumber ? ` | Job: ${parsed.jobNumber}` : ""}${parsed.clientName ? ` | Client: ${parsed.clientName}` : ""}${status ? ` | Status: ${status}` : ""}${group ? ` | Group: ${group}` : ""}${roomList}`;
        });
        sections.push(lines.join("\n"));
        sections.push(
          `(Board ID: ${board.id}. IMPORTANT: Pass only PARENT item IDs to createProjectsFromMondayItems — subitems will automatically become rooms (ProjectItems) inside each project: ${parentIds.map((id) => `"${id}"`).join(", ")}.)`
        );
      }
    } catch (err) {
      sections.push(`Board ${board.name ?? board.id}: error — ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return sections.join("\n\n");
}

async function handleCreateProjectFromMondayItem(
  args: Record<string, unknown>
): Promise<{ result: string; isAction: true; actionPayload: Record<string, unknown> }> {
  const config = await getAppConfig();
  const { id: boardId, label: boardLabel } = resolveMondayBoardIdForAction(args.boardId, config);
  const itemId = args.itemId as string;
  return {
    result: `Proposed creating a draft project from Monday item ${itemId} on board ${boardLabel}. Awaiting your approval.`,
    isAction: true,
    actionPayload: {
      action: "createProjectFromMonday",
      boardId,
      itemId,
    },
  };
}

async function handleSearchInventory(query: string): Promise<string> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      OR: [
        { materialCode: { contains: query } },
        { description: { contains: query } },
      ],
    },
    take: 15,
    orderBy: { materialCode: "asc" },
  });

  if (items.length === 0) return `No inventory items found matching "${query}"`;

  const state = await computeInventoryState(items.map((i) => i.materialCode));
  const stateMap = new Map(state.map((s) => [s.materialCode, s]));

  return items
    .map((i) => {
      const s = stateMap.get(i.materialCode);
      return `${i.materialCode} — ${i.description} (${i.unit}): onHand=${s?.onHand ?? i.onHand}, available=${s?.availableQty ?? i.onHand}`;
    })
    .join("\n");
}

function handleReceiveInventory(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const materialCode = args.materialCode as string;
  const quantity = args.quantity as number;
  return {
    result: `Proposed receiving ${quantity} × ${materialCode} into inventory. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "receiveInventory",
      materialCode,
      quantity,
      note: args.note ?? null,
      orderId: args.orderId ?? null,
    },
  };
}

function handleCreateInventoryItem(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  return {
    result: `Proposed creating new inventory item: ${args.materialCode} — ${args.description}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "createInventoryItem",
      materialCode: args.materialCode,
      description: args.description,
      unit: args.unit ?? "sheets",
      onHand: args.onHand ?? 0,
      category: args.category ?? "sheetGoods",
      minThreshold: args.minThreshold ?? 0,
    },
  };
}

function handleUpdateProjectStatus(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const status = args.status as string;
  const label = status === "active" ? "activate" : status === "done" ? "mark as done" : "reopen as draft";
  return {
    result: `Proposed to ${label} project ${args.projectId}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "updateProjectStatus",
      projectId: args.projectId,
      status,
    },
  };
}

function handleReceiveOrder(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const lines = args.lines as { orderLineId: string; receivedQty: number }[] | undefined;
  const summary = lines
    ? `${lines.length} line(s) (partial)`
    : "all lines at ordered quantities";
  return {
    result: `Proposed receiving order ${args.orderId} — ${summary}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "receiveOrder",
      orderId: args.orderId,
      lines: args.lines ?? null,
    },
  };
}

async function handleListEmployees(role?: string): Promise<string> {
  const employees = await prisma.employee.findMany({
    where: { active: true, ...(role ? { role } : {}) },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  if (employees.length === 0) return role ? `No active ${role}s found.` : "No employees found.";
  return employees.map((e) => `${e.name} (${e.role})${e.email ? ` — ${e.email}` : ""}`).join("\n");
}

async function handleGetActivePunches(): Promise<string> {
  const punches = await prisma.timePunch.findMany({
    where: { endTime: null },
    include: {
      employee: { select: { name: true, role: true } },
      station: { select: { name: true } },
      project: { select: { name: true, jobNumber: true } },
    },
    orderBy: { startTime: "asc" },
  });
  if (punches.length === 0) return "Nobody is currently clocked in.";
  const lines = punches.map((p) => {
    const mins = Math.round((Date.now() - new Date(p.startTime).getTime()) / 60000);
    const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return `${p.employee.name} @ ${p.station?.name ?? "unknown station"} — ${p.project ? (p.project.jobNumber ?? p.project.name) : "general work"} (${dur})`;
  });
  return `${punches.length} people on the floor:\n${lines.join("\n")}`;
}

async function handleListWarehouseSections(): Promise<string> {
  const sections = await prisma.warehouseSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true },
  });
  if (sections.length === 0) return "No warehouse sections configured yet.";
  return sections
    .map((s) => `[${s.id}] ${s.name}${s.description ? ` — ${s.description}` : ""}`)
    .join("\n");
}

function handleProposeCreateWarehouseSection(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const name = String(args.name ?? "").trim();
  const description = typeof args.description === "string" ? args.description.trim() : "";
  const sortOrderRaw = args.sortOrder as number | undefined;
  const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : undefined;
  return {
    result: `Proposed creating warehouse section "${name}"${description ? ` — ${description}` : ""}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "createWarehouseSection",
      name,
      description: description || null,
      sortOrder: sortOrder ?? null,
    },
  };
}

function handleProposeSetInventoryLocation(
  args: Record<string, unknown>
): { result: string; isAction: true; actionPayload: Record<string, unknown> } {
  const materialCode = String(args.materialCode ?? "").trim();
  const section = String(args.section ?? "").trim();
  const locationNote = typeof args.locationNote === "string" ? args.locationNote.trim() : "";
  return {
    result: `Proposed setting inventory location for ${materialCode}: section "${section}"${locationNote ? ` (${locationNote})` : ""}. Awaiting user approval.`,
    isAction: true,
    actionPayload: {
      action: "setInventoryItemLocation",
      materialCode,
      section,
      locationNote: locationNote || null,
    },
  };
}

async function handleGetLaborHours(projectIdOrRef?: string, employeeId?: string): Promise<string> {
  let projectId: string | undefined;
  if (projectIdOrRef) {
    const resolved = await resolveProjectId(projectIdOrRef);
    projectId = resolved ?? undefined;
    if (!projectId) return `Project not found: ${projectIdOrRef}`;
  }

  const punches = await prisma.timePunch.findMany({
    where: {
      endTime: { not: null },
      ...(projectId ? { projectId } : {}),
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { name: true } },
      station: { select: { name: true } },
      project: { select: { name: true, jobNumber: true } },
    },
    orderBy: { startTime: "desc" },
  });

  if (punches.length === 0) return "No labor hours logged for the specified filters.";

  const totalMins = punches.reduce((s, p) => s + (p.durationMinutes ?? 0), 0);
  const totalH = (totalMins / 60).toFixed(1);

  // Group by employee
  const byEmployee = new Map<string, number>();
  for (const p of punches) {
    const key = p.employee.name;
    byEmployee.set(key, (byEmployee.get(key) ?? 0) + (p.durationMinutes ?? 0));
  }

  const lines = [`Total: ${totalH}h (${punches.length} punches)`, ""];
  for (const [name, mins] of Array.from(byEmployee)) {
    lines.push(`  ${name}: ${(mins / 60).toFixed(1)}h`);
  }

  return lines.join("\n");
}

function resolveMondayBoardIdForAction(
  rawBoardId: unknown,
  config: Awaited<ReturnType<typeof getAppConfig>>
): { id: string; label: string } {
  const input = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!input) {
    throw new Error("boardId is required for Monday actions.");
  }

  // If it already looks like a numeric board ID, use it directly.
  if (/^\d+$/.test(input)) {
    return { id: input, label: input };
  }

  // Otherwise, treat it as a human board name and resolve against configured boards.
  type BoardRef = { id: string; name?: string };
  const boardsConfig = (config.integrations?.mondayBoards as BoardRef[] | undefined) ?? [];
  const legacyId = (config.integrations?.mondayBoardId as string | undefined)?.trim();
  const allBoards: BoardRef[] =
    boardsConfig.length > 0
      ? boardsConfig
      : legacyId
        ? [{ id: legacyId, name: undefined }]
        : [];

  const matches = allBoards.filter((b) => b.name?.toLowerCase().includes(input.toLowerCase()));
  if (matches.length === 0) {
    const names = allBoards.map((b) => b.name || b.id).filter(Boolean).join(", ") || "(none — only IDs)";
    throw new Error(
      `No Monday board is configured with the name "${input}". Configured board names are: ${names}.`
    );
  }

  const chosen = matches[0];
  const label = chosen.name ? `${chosen.name} (${chosen.id})` : chosen.id;
  return { id: chosen.id, label };
}

async function handleCreateProjectsFromMondayItems(
  args: Record<string, unknown>
): Promise<{ result: string; isAction: boolean; actionPayload?: Record<string, unknown> }> {
  const config = await getAppConfig();
  const { id: boardId, label: boardLabel } = resolveMondayBoardIdForAction(args.boardId, config);
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
    result: `Proposed creating ${count} draft project(s) from Monday items on board ${boardLabel}. Awaiting your approval.`,
    isAction: true,
    actionPayload:
      count === 1
        ? { action: "createProjectFromMonday", boardId, itemId: items[0].itemId }
        : { action: "createProjectFromMonday", items },
  };
}
