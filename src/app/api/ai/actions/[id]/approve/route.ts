import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { getMondayItemAsProject } from "@/lib/monday";
import {
  triggerInventoryRecalcForMaterial,
  triggerOrderInventoryRecalc,
} from "@/lib/observability/recalculateProjectState";

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

        // Validate materialCode exists
        const invCheck = await prisma.inventoryItem.findUnique({
          where: { materialCode: materialCode as string },
          select: { id: true },
        });
        if (!invCheck) {
          return NextResponse.json(
            { error: `Material code not found: ${materialCode}. Create it in inventory first or use createInventoryItem.` },
            { status: 404 }
          );
        }

        // Resolve project ID
        let resolvedProjectId = projectId;
        const directCheck = await prisma.project.findUnique({ where: { id: projectId as string }, select: { id: true } });
        if (!directCheck) {
          const byJob = await prisma.project.findFirst({ where: { jobNumber: projectId as string }, select: { id: true } });
          if (!byJob) {
            return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 });
          }
          resolvedProjectId = byJob.id;
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

      case "receiveInventory": {
        const { materialCode, quantity, note, orderId } = payload as {
          materialCode: string;
          quantity: number;
          note?: string;
          orderId?: string;
        };

        const invItem = await prisma.inventoryItem.findUnique({ where: { materialCode } });
        if (!invItem) {
          return NextResponse.json({ error: `Inventory item not found: ${materialCode}` }, { status: 404 });
        }

        await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              inventoryItemId: invItem.id,
              type: "receive",
              quantity,
              note: note ?? null,
              orderLineId: orderId ?? null,
            },
          }),
          prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { onHand: { increment: quantity }, stockQty: { increment: quantity } },
          }),
        ]);

        triggerInventoryRecalcForMaterial(materialCode).catch(() => {});
        result = { status: "inventory_received", materialCode, quantity, newOnHand: invItem.onHand + quantity };
        break;
      }

      case "createInventoryItem": {
        const { materialCode, description, unit, onHand, category, minThreshold } = payload as {
          materialCode: string;
          description: string;
          unit?: string;
          onHand?: number;
          category?: string;
          minThreshold?: number;
        };

        const existing = await prisma.inventoryItem.findUnique({ where: { materialCode } });
        if (existing) {
          return NextResponse.json({ error: `Material code already exists: ${materialCode}` }, { status: 409 });
        }

        const newItem = await prisma.inventoryItem.create({
          data: {
            materialCode,
            description,
            unit: unit ?? "sheets",
            onHand: onHand ?? 0,
            stockQty: onHand ?? 0,
            category: category ?? "sheetGoods",
            minThreshold: minThreshold ?? 0,
          },
        });

        result = { status: "item_created", id: newItem.id, materialCode };
        break;
      }

      case "updateProjectStatus": {
        const { projectId: statusProjectId, status } = payload as {
          projectId: string;
          status: "active" | "done" | "draft";
        };

        // Resolve project ID
        let resolvedId = statusProjectId;
        const directCheck = await prisma.project.findUnique({ where: { id: statusProjectId }, select: { id: true } });
        if (!directCheck) {
          const byJob = await prisma.project.findFirst({ where: { jobNumber: statusProjectId }, select: { id: true } });
          if (!byJob) {
            return NextResponse.json({ error: `Project not found: ${statusProjectId}` }, { status: 404 });
          }
          resolvedId = byJob.id;
        }

        const statusData =
          status === "active"
            ? { isDraft: false, isDone: false }
            : status === "done"
              ? { isDraft: false, isDone: true }
              : { isDraft: true, isDone: false };

        await prisma.project.update({ where: { id: resolvedId }, data: statusData });
        result = { status: "project_updated", projectId: resolvedId, newStatus: status };
        break;
      }

      case "receiveOrder": {
        const { orderId, lines: receiveLines } = payload as {
          orderId: string;
          lines?: { orderLineId: string; receivedQty: number }[];
        };

        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { lines: { include: { inventoryItem: true } } },
        });
        if (!order) {
          return NextResponse.json({ error: `Order not found: ${orderId}` }, { status: 404 });
        }
        if (order.status === "cancelled") {
          return NextResponse.json({ error: "Cannot receive a cancelled order" }, { status: 400 });
        }

        const lineUpdates = new Map<string, number>();
        if (receiveLines && receiveLines.length > 0) {
          for (const l of receiveLines) lineUpdates.set(l.orderLineId, l.receivedQty);
        } else {
          for (const l of order.lines) lineUpdates.set(l.id, l.quantity);
        }

        const materialCodesToRecalc: string[] = [];

        await prisma.$transaction(async (tx) => {
          for (const line of order.lines) {
            const qty = lineUpdates.get(line.id);
            if (!qty || qty <= 0) continue;

            await tx.orderLine.update({
              where: { id: line.id },
              data: { receivedQty: { increment: qty } },
            });

            if (line.inventoryItemId) {
              await tx.inventoryItem.update({
                where: { id: line.inventoryItemId },
                data: { onHand: { increment: qty }, stockQty: { increment: qty } },
              });
              await tx.stockMovement.create({
                data: {
                  inventoryItemId: line.inventoryItemId,
                  type: "receive",
                  quantity: qty,
                  note: `Received via order ${orderId} (AI-approved)`,
                  orderLineId: line.id,
                },
              });
              materialCodesToRecalc.push(line.materialCode);
            }
          }

          const updatedLines = await tx.orderLine.findMany({ where: { orderId } });
          const allReceived = updatedLines.every((l) => l.receivedQty >= l.quantity);
          const anyReceived = updatedLines.some((l) => l.receivedQty > 0);
          await tx.order.update({
            where: { id: orderId },
            data: { status: allReceived ? "received" : anyReceived ? "partial" : order.status },
          });
        });

        triggerOrderInventoryRecalc(order.projectId);
        for (const code of materialCodesToRecalc) {
          triggerInventoryRecalcForMaterial(code).catch(() => {});
        }
        result = { status: "order_received", orderId };
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
