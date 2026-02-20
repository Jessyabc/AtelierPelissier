import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const templates = await prisma.processTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(templates);
  } catch (err) {
    console.error("GET /api/process-templates error:", err);
    return NextResponse.json(
      { error: "Failed to load process templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, description } = body as { name?: string; description?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }
  try {
    const template = await prisma.processTemplate.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
      },
    });
    return NextResponse.json(template);
  } catch (err) {
    console.error("POST /api/process-templates error:", err);
    return NextResponse.json(
      { error: "Failed to create process template" },
      { status: 500 }
    );
  }
}
