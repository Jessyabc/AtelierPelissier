import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";

type Params = { id: string; cutlistId: string };

const updateCutlistSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const PATCH = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id: projectId, cutlistId } = params;
    const cutlist = await prisma.cutlist.findFirst({
      where: { id: cutlistId },
      include: { projectItem: { select: { projectId: true } } },
    });
    if (!cutlist || cutlist.projectItem.projectId !== projectId) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = updateCutlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await prisma.cutlist.update({
      where: { id: cutlistId },
      data: {
        ...(parsed.data.name != null && { name: parsed.data.name }),
        ...(parsed.data.sortOrder != null && { sortOrder: parsed.data.sortOrder }),
      },
    });
    return NextResponse.json(updated);
  }
);

export const DELETE = withAuth<Params>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId, cutlistId } = params;
    const cutlist = await prisma.cutlist.findFirst({
      where: { id: cutlistId },
      include: { projectItem: { select: { projectId: true } } },
    });
    if (!cutlist || cutlist.projectItem.projectId !== projectId) {
      return NextResponse.json({ error: "Cutlist not found" }, { status: 404 });
    }

    await prisma.panelPart.updateMany({
      where: { cutlistId },
      data: { cutlistId: null },
    });
    await prisma.cutlist.delete({ where: { id: cutlistId } });
    return NextResponse.json({ ok: true });
  }
);
