import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const employees = await prisma.employee.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, email, role, color } = body as Record<string, string>;
  if (!name?.trim() || !role?.trim()) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }
  const employee = await prisma.employee.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      role: role.trim(),
      color: color?.trim() || "#6366f1",
    },
  });
  return NextResponse.json(employee, { status: 201 });
}
