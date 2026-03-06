import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET /api/clients?q=search — search clients by name, email, or phone */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }
  try {
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { phone2: { contains: q } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        phone2: true,
        address: true,
      },
    });
    return NextResponse.json(clients);
  } catch (err) {
    console.error("GET /api/clients error:", err);
    return NextResponse.json({ error: "Failed to search clients" }, { status: 500 });
  }
}

/** POST /api/clients — create a new client */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const schema = {
    firstName: typeof body === "object" && body !== null && "firstName" in body ? String((body as { firstName?: unknown }).firstName ?? "").trim() : "",
    lastName: typeof body === "object" && body !== null && "lastName" in body ? String((body as { lastName?: unknown }).lastName ?? "").trim() : "",
    email: typeof body === "object" && body !== null && "email" in body ? String((body as { email?: unknown }).email ?? "").trim() || null : null,
    phone: typeof body === "object" && body !== null && "phone" in body ? String((body as { phone?: unknown }).phone ?? "").trim() || null : null,
    phone2: typeof body === "object" && body !== null && "phone2" in body ? String((body as { phone2?: unknown }).phone2 ?? "").trim() || null : null,
    address: typeof body === "object" && body !== null && "address" in body ? String((body as { address?: unknown }).address ?? "").trim() || null : null,
  };
  if (!schema.firstName || !schema.lastName) {
    return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
  }
  try {
    const client = await prisma.client.create({
      data: schema,
    });
    return NextResponse.json(client);
  } catch (err) {
    console.error("POST /api/clients error:", err);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
