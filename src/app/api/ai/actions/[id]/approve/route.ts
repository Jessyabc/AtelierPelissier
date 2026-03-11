import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { getMondayItemAsProject } from "@/lib/monday";
import { triggerInventoryRecalcForMaterial } from "@/lib/observability/recalculateProjectState";

/**
 * POST /api/ai/actions/[id]/approve
 * Approve and execute a queued AI action.
 *
 * Body: { approved: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id;
    const body = await req.json();
    const approved = body.approved !== false;

    const message = await prisma.aiMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.actionStatus !== "pending") {
      return NextResponse.json({ error: "Action already executed or in progress" }, { status: 400 });
    }

    if (!approved) {
      await prisma.aiMessage.update({
        where: { id: messageId },
        data: { actionStatus: "rejected" },
      });
      return NextResponse.json({ status: "rejected" });
    }

    // Mark executing immediately so duplicate requests (e.g. double-click) get 400
    await prisma.aiMessage.update({
      where: { id: messageId },
      data: { actionStatus: "executing" },
    });

    // Execute the action
    const payload = message.functionCall ? JSON.parse(message.functionCall) : null;
    if (!payload) {
      return NextResponse.json({ error: "No action payload" }, { status: 400 });
    }

    let result: Record<string, unknown> = {};

    switch (payload.action) {
      case "createOrder": {
        // Resolve items to inventory IDs
        const items = payload.items as { materialCode: string; quantity: number }[];
        const invItems = await prisma.inventoryItem.findMany({
          where: { materialCode: { in: items.map((i) => i.materialCode) } },
        });
        const invMap = new Map(invItems.map((i) => [i.materialCode, i]));

        // Find or determine supplier
        const firstItem = invItems[0];
        let supplierId: string | null = null;
        if (firstItem) {
          const catalog = await prisma.supplierCatalogItem.findFirst({
            where: { inventoryItemId: firstItem.id, isDefault: true },
          });
          supplierId = catalog?.supplierId ?? null;
          if (!supplierId) {
            const anyCatalog = await prisma.supplierCatalogItem.findFirst({
              where: { inventoryItemId: firstItem.id },
            });
            supplierId = anyCatalog?.supplierId ?? null;
          }
        }

        const supplier = supplierId
          ? await prisma.supplier.findUnique({ where: { id: supplierId } })
          : null;

        const order = await prisma.order.create({
          data: {
            supplier: supplier?.name ?? "Unknown",
            supplierId: supplier?.id,
            status: "draft",
            orderType: payload.orderType ?? "order",
            lines: {
              create: items.map((item) => ({
                inventoryItemId: invMap.get(item.materialCode)?.id,
                materialCode: item.materialCode,
                quantity: item.quantity,
                unitCost: 0,
              })),
            },
          },
        });

        result = { orderId: order.id, status: "draft_created" };
        break;
      }

      case "addMaterial": {
        const { projectId, materialCode, quantity } = payload;
        // Resolve project ID
        let resolvedProjectId = projectId;
        const directCheck = await prisma.project.findUnique({ where: { id: projectId as string }, select: { id: true } });
        if (!directCheck) {
          const byJob = await prisma.project.findFirst({ where: { jobNumber: projectId as string }, select: { id: true } });
          resolvedProjectId = byJob?.id ?? projectId;
        }

        await prisma.materialRequirement.upsert({
          where: {
            projectId_materialCode: {
              projectId: resolvedProjectId as string,
              materialCode: materialCode as string,
            },
          },
          update: { requiredQty: { increment: quantity as number } },
          create: {
            projectId: resolvedProjectId as string,
            materialCode: materialCode as string,
            requiredQty: quantity as number,
          },
        });

        triggerInventoryRecalcForMaterial(materialCode as string).catch(() => {});
        result = { status: "material_added" };
        break;
      }

      case "openEmail": {
        // The frontend handles opening the mailto link
        result = { mailto: payload.mailto, status: "email_ready" };
        break;
      }

      case "createProjectFromMonday": {
        const config = await getAppConfig();
        const apiKey = config.integrations?.mondayApiKey as string | undefined;
        if (!apiKey?.trim()) {
          return NextResponse.json({ error: "Monday API key not configured" }, { status: 400 });
        }
        const key = apiKey.trim();

        // Batch: payload.items = [ { boardId, itemId }, ... ]; single: payload.boardId + payload.itemId
        const entries: { boardId: string; itemId: string }[] = payload.items
          ? (payload.items as { boardId: string; itemId: string }[])
          : payload.boardId && payload.itemId
            ? [{ boardId: payload.boardId as string, itemId: payload.itemId as string }]
            : [];

        if (entries.length === 0) {
          return NextResponse.json({ error: "No Monday items to create", details: "Payload missing items or boardId/itemId" }, { status: 400 });
        }

        const created: { id: string; name: string }[] = [];
        const errors: string[] = [];

        for (const { boardId, itemId } of entries) {
          try {
            const mapped = await getMondayItemAsProject(key, boardId, itemId);
            const name = mapped.name?.trim() || "New project";
            const jobNumber = mapped.jobNumber?.trim() || null;
            const project = await prisma.project.create({
              data: {
                name,
                type: "custom",
                types: "custom",
                jobNumber,
                notes: mapped.notes ?? null,
                isDraft: true,
                isDone: false,
                clientFirstName: mapped.clientName ? mapped.clientName.split(/\s+/)[0] ?? null : null,
                clientLastName: mapped.clientName ? mapped.clientName.split(/\s+/).slice(1).join(" ") || null : null,
              },
            });
            created.push({ id: project.id, name: project.name });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${itemId}: ${msg}`);
          }
        }

        result = {
          status: created.length ? "project_created" : "failed",
          projectId: created[0]?.id ?? null,
          projectIds: created.map((p) => p.id),
          count: created.length,
          total: entries.length,
          errors: errors.length ? errors : undefined,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${payload.action}` }, { status: 400 });
    }

    await prisma.aiMessage.update({
      where: { id: messageId },
      data: { actionStatus: "executed" },
    });

    return NextResponse.json({ status: "executed", result });
  } catch (err) {
    console.error("POST /api/ai/actions approve error:", err);
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
