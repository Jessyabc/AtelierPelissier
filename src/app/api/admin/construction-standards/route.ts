/**
 * Admin API: Construction Standards (singleton)
 * GET  — read current construction standards
 * PATCH — update standards (admin-only)
 *
 * Follows the same pattern as /api/admin/config and /api/settings/global.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CABINET_DEFAULTS } from "@/lib/ingredients/types";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  const row = await prisma.constructionStandards.findFirst();
  return NextResponse.json(row ?? CABINET_DEFAULTS);
}

export async function PATCH(request: Request) {
  const auth = await requireRole(["admin"]);
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate that all provided fields are valid numbers
  const allowedFields = Object.keys(CABINET_DEFAULTS);
  const updateData: Record<string, number> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowedFields.includes(key)) continue;
    if (typeof value !== "number" || value < 0) {
      return NextResponse.json(
        { error: `Invalid value for ${key}: must be a positive number` },
        { status: 400 }
      );
    }
    updateData[key] = value;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Upsert: create if no row exists, update if it does
  const existing = await prisma.constructionStandards.findFirst();

  let result;
  if (existing) {
    result = await prisma.constructionStandards.update({
      where: { id: existing.id },
      data: updateData,
    });
  } else {
    result = await prisma.constructionStandards.create({
      data: updateData as Record<string, number>,
    });
  }

  return NextResponse.json(result);
}
