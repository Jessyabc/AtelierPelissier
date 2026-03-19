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
  const { name, email, role, color, hourlyRate } = body as Record<string, unknown>;
  if (!(name as string)?.trim() || !(role as string)?.trim()) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }
  const employee = await prisma.employee.create({
    data: {
      name: (name as string).trim(),
      email: typeof email === "string" ? email.trim() || null : null,
      role: (role as string).trim(),
      color: typeof color === "string" ? color.trim() : "#6366f1",
      hourlyRate: typeof hourlyRate === "number" ? hourlyRate : null,
    },
  });
  return NextResponse.json(employee, { status: 201 });
}
