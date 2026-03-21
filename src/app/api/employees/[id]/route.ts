import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, email, role, color, active, hourlyRate } = body as Record<string, unknown>;
  const employee = await prisma.employee.update({
    where: { id: params.id },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(email !== undefined && { email: typeof email === "string" ? email.trim() || null : null }),
      ...(typeof role === "string" && { role: role.trim() }),
      ...(typeof color === "string" && { color: color.trim() }),
      ...(typeof active === "boolean" && { active }),
      ...(hourlyRate !== undefined && { hourlyRate: typeof hourlyRate === "number" ? hourlyRate : null }),
    },
  });
  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await prisma.employee.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
