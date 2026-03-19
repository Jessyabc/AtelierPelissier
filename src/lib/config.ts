/**
 * Centralized app configuration utility.
 *
 * Reads the AppConfig singleton from the database and provides typed
 * accessors with sensible defaults that match the previously-hardcoded values.
 */

import { prisma } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export type MenuItem = {
  href: string;
  label: string;
  visible: boolean;
  order: number;
  exportData?: boolean;
};

export type RoomType = {
  value: string;
  label: string;
  icon: string;
  desc: string;
  builtIn?: boolean;
};

export type EmailTemplates = {
  supplierOrder: string;
  supplierReserve: string;
  clientFollowup: string;
};

export type MondayBoardRef = { id: string; name?: string };

export type Integrations = {
  mondayApiKey?: string;
  /** Single default board (legacy). If mondayBoards is set, first entry is used as default when needed. */
  mondayBoardId?: string;
  /** Multiple boards: id + optional label. AI can list items from any of these. */
  mondayBoards?: MondayBoardRef[];
  sageEnabled?: boolean;
  /** Sage Business Cloud Accounting OAuth — from app registration. */
  sageClientId?: string;
  sageClientSecret?: string;
  /** Set after user completes OAuth callback. */
  sageAccessToken?: string;
  sageRefreshToken?: string;
  /** Access token expiry (seconds since epoch). */
  sageTokenExpiresAt?: number;
  [key: string]: unknown;
};

export type AppConfigData = {
  id: string;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoUrl: string | null;
  menuConfig: MenuItem[];
  customRoomTypes: RoomType[];
  processDefaults: Record<string, string>;
  materialAliases: Record<string, string>;
  emailTemplates: EmailTemplates;
  integrations: Integrations;
};

// ── Defaults (match the previously-hardcoded values) ───────────────────

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { href: "/home", label: "Operations Cockpit", visible: true, order: 0 },
  { href: "/", label: "Projects", visible: true, order: 1 },
  { href: "/projects/new", label: "New project", visible: true, order: 2 },
  { href: "/assistant", label: "AI Assistant", visible: true, order: 3 },
  { href: "/dashboard", label: "Executive Dashboard", visible: true, order: 4 },
  { href: "/inventory", label: "Inventory", visible: true, order: 5 },
  { href: "/distributors", label: "Suppliers & Purchasing", visible: true, order: 6 },
  { href: "/costing", label: "Costing", visible: true, order: 7 },
  { href: "/processes", label: "Processes", visible: true, order: 8 },
  { href: "/service-calls", label: "Service calls", visible: true, order: 9 },
  { href: "/calendar", label: "Calendar", visible: true, order: 10 },
  { href: "/settings/risk", label: "Risk settings", visible: true, order: 11 },
  { href: "/admin", label: "Admin Hub", visible: true, order: 12 },
  { href: "/admin/employees", label: "Team Members", visible: true, order: 13 },
  { href: "/admin/stations", label: "Work Stations & QR", visible: true, order: 14 },
  { href: "/admin/punches", label: "Punch Board", visible: true, order: 15 },
  { href: "#export", label: "Export data (backup)", visible: true, order: 16, exportData: true },
];

export const BUILT_IN_ROOM_TYPES: RoomType[] = [
  { value: "kitchen", label: "Kitchen", icon: "🍳", desc: "Cabinets, countertops, islands", builtIn: true },
  { value: "vanity", label: "Vanity / Bathroom", icon: "🚿", desc: "Vanities, medicine cabinets", builtIn: true },
  { value: "closet", label: "Closet / Storage", icon: "🗄", desc: "Walk-in, reach-in, pantry", builtIn: true },
  { value: "commercial", label: "Commercial / Office", icon: "🏢", desc: "Reception, built-ins", builtIn: true },
  { value: "laundry", label: "Laundry Room", icon: "🧺", desc: "Laundry cabinetry", builtIn: true },
  { value: "entertainment", label: "Entertainment Center", icon: "📺", desc: "Wall units, media", builtIn: true },
  { value: "custom", label: "Custom Piece", icon: "🔨", desc: "Shelves, furniture, one-offs", builtIn: true },
];

export const DEFAULT_MATERIAL_ALIASES: Record<string, string> = {
  "white melamine": "MEL-WHT-5/8-4x8",
  "white mel": "MEL-WHT-5/8-4x8",
  "melamine blanche": "MEL-WHT-5/8-4x8",
  "mel blanche": "MEL-WHT-5/8-4x8",
  "edgebanding": "EDGE",
  "edge banding": "EDGE",
  "chant": "EDGE",
  "hinge": "HW-HINGE",
  "hinges": "HW-HINGE",
  "charnieres": "HW-HINGE",
  "drawer kit": "HW-DRAWER-KIT",
  "drawer kits": "HW-DRAWER-KIT",
  "tiroir": "HW-DRAWER-KIT",
  "handle": "HW-HANDLE",
  "handles": "HW-HANDLE",
  "poignees": "HW-HANDLE",
};

const DEFAULT_EMAIL_SUPPLIER_ORDER = `Hello {supplierName} team,

We would like to place an order for the following materials:

{materialList}

Reference: {projectRef}
Requested delivery by: {deliveryDate}
{notes}

Please confirm availability and expected delivery date.

Thank you,
{companyName}`;

const DEFAULT_EMAIL_SUPPLIER_RESERVE = `Hello {supplierName} team,

We would like to reserve the following materials:

{materialList}

Reference: {projectRef}
Requested delivery by: {deliveryDate}
{notes}

Please confirm availability and expected delivery date.

Thank you,
{companyName}`;

const DEFAULT_EMAIL_CLIENT_FOLLOWUP = `Hello {clientName},

This is a follow-up regarding your project {projectRef}.

{body}

Thank you,
{companyName}`;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  supplierOrder: DEFAULT_EMAIL_SUPPLIER_ORDER,
  supplierReserve: DEFAULT_EMAIL_SUPPLIER_RESERVE,
  clientFollowup: DEFAULT_EMAIL_CLIENT_FOLLOWUP,
};

// ── JSON parsing helpers ───────────────────────────────────────────────

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Main accessor ──────────────────────────────────────────────────────

export async function getAppConfig(): Promise<AppConfigData> {
  type ConfigRow = Awaited<ReturnType<typeof prisma.appConfig.findMany>>[number];
  let row: ConfigRow | null = null;
  try {
    const rows = await prisma.appConfig.findMany({ take: 1 });
    row = rows[0] ?? null;
  } catch (e) {
    console.warn("getAppConfig: DB read failed, using defaults", e);
  }

  if (!row) {
    return {
      id: "",
      companyName: "Atelier Pelissier",
      companyEmail: null,
      companyPhone: null,
      companyAddress: null,
      logoUrl: null,
      menuConfig: DEFAULT_MENU_ITEMS,
      customRoomTypes: [],
      processDefaults: {},
      materialAliases: DEFAULT_MATERIAL_ALIASES,
      emailTemplates: DEFAULT_EMAIL_TEMPLATES,
      integrations: {},
    };
  }

  return {
    id: row.id,
    companyName: row.companyName,
    companyEmail: row.companyEmail,
    companyPhone: row.companyPhone,
    companyAddress: row.companyAddress,
    logoUrl: row.logoUrl,
    menuConfig: (() => {
      const saved = parseJson<MenuItem[]>(row.menuConfig, DEFAULT_MENU_ITEMS);
      const savedHrefs = new Set(saved.map((m) => m.href));
      const missing = DEFAULT_MENU_ITEMS.filter((m) => !savedHrefs.has(m.href));
      return missing.length > 0 ? [...saved, ...missing] : saved;
    })(),
    customRoomTypes: parseJson<RoomType[]>(row.customRoomTypes, []),
    processDefaults: parseJson<Record<string, string>>(row.processDefaults, {}),
    materialAliases: parseJson<Record<string, string>>(row.materialAliases, DEFAULT_MATERIAL_ALIASES),
    emailTemplates: parseJson<EmailTemplates>(row.emailTemplates, DEFAULT_EMAIL_TEMPLATES),
    integrations: parseJson<Integrations>(row.integrations, {}),
  };
}

// ── Typed accessors ────────────────────────────────────────────────────

export function getCompanyName(config: AppConfigData): string {
  return config.companyName || "Atelier Pelissier";
}

export function getMenuItems(config: AppConfigData): MenuItem[] {
  return [...config.menuConfig].sort((a, b) => a.order - b.order).filter((m) => m.visible);
}

export function getAllRoomTypes(config: AppConfigData): RoomType[] {
  return [...BUILT_IN_ROOM_TYPES, ...config.customRoomTypes];
}

export function getMaterialAliases(config: AppConfigData): Record<string, string> {
  return { ...DEFAULT_MATERIAL_ALIASES, ...config.materialAliases };
}

export function getEmailTemplate(config: AppConfigData, type: keyof EmailTemplates): string {
  return config.emailTemplates[type] || DEFAULT_EMAIL_TEMPLATES[type];
}
