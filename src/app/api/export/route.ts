import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET: Export all data as JSON backup.
 * Save the response to a file on your computer for safekeeping.
 */
export async function GET() {
  const [projects, distributors] = await Promise.all([
    prisma.project.findMany({
      include: {
        projectSettings: { include: { sheetFormat: true } },
        vanityInputs: true,
        sideUnitInputs: true,
        kitchenInputs: true,
        panelParts: true,
        costLines: true,
        serviceCalls: { include: { items: true } },
      },
    }),
    prisma.distributor.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    projects,
    distributors,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="atelier-pelissier-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
