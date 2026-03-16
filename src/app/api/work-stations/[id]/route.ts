import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, location, active, sortOrder } = body as Record<string, unknown>;
  const station = await prisma.workStation.update({
    where: { id: params.id },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(location !== undefined && { location: typeof location === "string" ? location.trim() || null : null }),
      ...(typeof active === "boolean" && { active }),
      ...(typeof sortOrder === "number" && { sortOrder }),
    },
  });
  return NextResponse.json(station);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await prisma.workStation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
