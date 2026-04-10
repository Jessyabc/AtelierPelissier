import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const stations = await prisma.workStation.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(stations);
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, location, sortOrder } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const slug = toSlug(name.trim());
  const station = await prisma.workStation.create({
    data: {
      name: name.trim(),
      slug,
      location: typeof location === "string" ? location.trim() || null : null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
    },
  });
  return NextResponse.json(station, { status: 201 });
}
