import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const formats = await prisma.sheetFormat.findMany({
    orderBy: { isCustom: "asc" },
  });
  return NextResponse.json(formats);
}
