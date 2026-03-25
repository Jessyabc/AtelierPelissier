import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const formats = await prisma.sheetFormat.findMany({
    orderBy: { isCustom: "asc" },
  });
  return NextResponse.json(formats);
}
