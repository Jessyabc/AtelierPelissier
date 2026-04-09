import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAppConfig,
  getDefaultAppConfig,
  DEFAULT_MENU_ITEMS,
  DEFAULT_MATERIAL_ALIASES,
  DEFAULT_EMAIL_TEMPLATES,
  type AppConfigData,
} from "@/lib/config";
import { getSessionWithUser, requireRole } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";

/** Ensure this handler is never statically prerendered at build time (Prisma / DATABASE_URL). */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeConfig(config: AppConfigData): AppConfigData {
  return { ...config, integrations: {} };
}

export async function GET() {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  try {
    const config = await getAppConfig();
    // If an admin is impersonating, treat them as the impersonated role for secret redaction.
    if (!isAdminRole(session.effectiveRole)) {
      return NextResponse.json(sanitizeConfig(config));
    }
    return NextResponse.json(config);
  } catch (e) {
    console.error("GET /api/admin/config failed", e);
    return NextResponse.json(getDefaultAppConfig());
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const body = await req.json();

  const rows = await prisma.appConfig.findMany({ take: 1 });
  let row = rows[0] ?? null;

  const data: Record<string, unknown> = {};

  if (body.companyName !== undefined) data.companyName = body.companyName;
  if (body.companyEmail !== undefined) data.companyEmail = body.companyEmail;
  if (body.companyPhone !== undefined) data.companyPhone = body.companyPhone;
  if (body.companyAddress !== undefined) data.companyAddress = body.companyAddress;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.defaultEmployeeRate !== undefined) data.defaultEmployeeRate = body.defaultEmployeeRate;

  if (body.menuConfig !== undefined)
    data.menuConfig = JSON.stringify(body.menuConfig);
  if (body.customRoomTypes !== undefined)
    data.customRoomTypes = JSON.stringify(body.customRoomTypes);
  if (body.processDefaults !== undefined)
    data.processDefaults = JSON.stringify(body.processDefaults);
  if (body.materialAliases !== undefined)
    data.materialAliases = JSON.stringify(body.materialAliases);
  if (body.emailTemplates !== undefined)
    data.emailTemplates = JSON.stringify(body.emailTemplates);
  if (body.integrations !== undefined)
    data.integrations = JSON.stringify(body.integrations);

  if (row) {
    await prisma.appConfig.update({ where: { id: row.id }, data });
  } else {
    row = await prisma.appConfig.create({
      data: {
        companyName: (data.companyName as string) ?? "Atelier Pelissier",
        companyEmail: (data.companyEmail as string) ?? null,
        companyPhone: (data.companyPhone as string) ?? null,
        companyAddress: (data.companyAddress as string) ?? null,
        logoUrl: (data.logoUrl as string) ?? null,
        menuConfig: (data.menuConfig as string) ?? JSON.stringify(DEFAULT_MENU_ITEMS),
        customRoomTypes: (data.customRoomTypes as string) ?? "[]",
        processDefaults: (data.processDefaults as string) ?? "{}",
        materialAliases: (data.materialAliases as string) ?? JSON.stringify(DEFAULT_MATERIAL_ALIASES),
        emailTemplates: (data.emailTemplates as string) ?? JSON.stringify(DEFAULT_EMAIL_TEMPLATES),
        integrations: (data.integrations as string) ?? "{}",
      },
    });
  }

  const config = await getAppConfig();
  return NextResponse.json(config);
}
