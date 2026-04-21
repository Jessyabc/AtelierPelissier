import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { panelPartUpdateSchema } from "@/lib/validators";
import { triggerMaterialInventoryOrderRecalc } from "@/lib/observability/recalculateProjectState";
import { withAuth } from "@/lib/auth/guard";

type Params = { id: string; partId: string };

export const PATCH = withAuth<Params>(
  ["admin", "planner"],
  async ({ req, params }) => {
    const { id: projectId, partId } = params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = panelPartUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const part = await prisma.panelPart.update({
      where: { id: partId },
      data: {
        ...(data.label != null && { label: data.label }),
        ...(data.lengthIn != null && { lengthIn: data.lengthIn }),
        ...(data.widthIn != null && { widthIn: data.widthIn }),
        ...(data.qty != null && { qty: data.qty }),
        ...(data.materialCode !== undefined && { materialCode: data.materialCode }),
        ...(data.thicknessIn !== undefined && { thicknessIn: data.thicknessIn }),
        ...(data.cutlistId !== undefined && { cutlistId: data.cutlistId }),
      },
    });
    triggerMaterialInventoryOrderRecalc(projectId);
    return NextResponse.json(part);
  }
);

export const DELETE = withAuth<Params>(
  ["admin", "planner"],
  async ({ params }) => {
    const { id: projectId, partId } = params;
    await prisma.panelPart.delete({ where: { id: partId } });
    triggerMaterialInventoryOrderRecalc(projectId);
    return NextResponse.json({ ok: true });
  }
);
