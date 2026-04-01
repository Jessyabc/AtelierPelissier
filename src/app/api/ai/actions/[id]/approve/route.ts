import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { getMondayItemAsProject } from "@/lib/monday";
import {
  triggerInventoryRecalcForMaterial,
  triggerOrderInventoryRecalc,
} from "@/lib/observability/recalculateProjectState";
import { getSessionWithUser } from "@/lib/auth/session";
import { canApproveAiActions, canSchedule } from "@/lib/auth/roles";
import { buildServiceCallNotificationDrafts } from "@/lib/notifications/serviceCallDrafts";
import { logAudit } from "@/lib/audit";
import { computeReadinessCheck } from "@/lib/readiness";

/**
 * POST /api/ai/actions/[id]/approve
 * Approve and execute a queued AI action.
 *
 * Body: { approved: boolean }
 */
function roleMayExecuteAction(role: string, action: string): boolean {
  if (action === "scheduleServiceCall") return canSchedule(role);
  if (action === "createDraftProjectAndServiceCall") return canSchedule(role);
  if (action === "openEmail") return true;
  return canApproveAiActions(role);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getSessionWithUser();
    if (!auth.ok) return auth.response;

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

    const payload = message.functionCall ? JSON.parse(message.functionCall) : null;
    if (!payload) {
      return NextResponse.json({ error: "No action payload" }, { status: 400 });
    }

    const actionName = payload.action as string;
    if (!roleMayExecuteAction(auth.dbUser.role, actionName)) {
      return NextResponse.json({ error: "Forbidden for your role" }, { status: 403 });
    }

    // Mark executing after auth + role checks (duplicate clicks while running still need the early pending check)
    await prisma.aiMessage.update({
      where: { id: messageId },
      data: { actionStatus: "executing" },
    });

    let result: Record<string, unknown> = {};

    switch (payload.action) {
      case "scheduleServiceCall": {
        const {
          projectId: pid,
          serviceDate,
          serviceTime,
          reasonForService,
          notes,
          technicianName,
        } = payload as {
          projectId: string;
          serviceDate: string;
          serviceTime?: string;
          reasonForService?: string;
          notes?: string;
          technicianName?: string;
        };

        const project = await prisma.project.findUnique({
          where: { id: pid },
        });
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const [y, m, d] = serviceDate.split("-").map(Number);
        if (!y || !m || !d) {
          return NextResponse.json({ error: "Invalid serviceDate" }, { status: 400 });
        }
        const dayStart = new Date(y, m - 1, d);
        const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

        let timeOfArrival: Date | null = null;
        if (serviceTime && /^\d{1,2}:\d{2}$/.test(serviceTime.trim())) {
          const [hh, mm] = serviceTime.split(":").map(Number);
          timeOfArrival = new Date(y, m - 1, d, hh, mm, 0, 0);
        }

        const clientName =
          [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ").trim() || null;

        const serviceCall = await prisma.serviceCall.create({
          data: {
            projectId: project.id,
            jobNumber: project.jobNumber,
            clientName,
            address: project.clientAddress,
            clientPhone: project.clientPhone,
            clientEmail: project.clientEmail,
            serviceDate: dayStart,
            timeOfArrival,
            reasonForService: reasonForService ?? null,
            notes: notes ?? null,
            technicianName: technicianName ?? null,
          },
        });

        const maxSort = await prisma.dayPlanItem.aggregate({
          where: { planDate: { gte: dayStart, lte: dayEnd } },
          _max: { sortOrder: true },
        });

        await prisma.dayPlanItem.create({
          data: {
            planDate: dayStart,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
            type: "service_call",
            serviceCallId: serviceCall.id,
          },
        });

        const appCfg = await getAppConfig();
        const notifyRaw = process.env.SERVICE_CALL_NOTIFY_EMAILS ?? "";
        const notifyEmails = notifyRaw
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);

        const drafts = buildServiceCallNotificationDrafts({
          companyName: appCfg.companyName || "WoodOps",
          project,
          serviceCall,
          dateLabel: serviceDate,
          timeLabel: serviceTime?.trim() ?? "",
          notifyEmails,
        });

        result = {
          status: "service_call_scheduled",
          serviceCallId: serviceCall.id,
          notificationDrafts: drafts,
        };
        break;
      }

      case "createDraftProjectAndServiceCall": {
        const p = payload as {
          projectName: string;
          clientName: string;
          clientEmail?: string | null;
          clientPhone?: string | null;
          clientAddress?: string | null;
          serviceDate?: string | null; // YYYY-MM-DD
          serviceTime?: string | null; // HH:MM
          technicianName?: string | null;
          serviceCallType?: string[] | null;
          reasonForService?: string | null;
          notes?: string | null;
          workItems?: Array<{ description: string; quantity?: string | null; providedBy?: string | null }> | null;
          rawMessage?: string | null;
        };

        const name = (p.projectName || `${p.clientName} — Service call`).trim();
        const [firstName, ...rest] = (p.clientName || "").trim().split(/\s+/).filter(Boolean);
        const lastName = rest.join(" ");

        const project = await prisma.project.create({
          data: {
            name,
            type: "service_call",
            types: "service_call",
            isDraft: true,
            jobNumber: null,
            clientFirstName: firstName || null,
            clientLastName: lastName || null,
            clientEmail: p.clientEmail ?? null,
            clientPhone: p.clientPhone ?? null,
            clientAddress: p.clientAddress ?? null,
            projectSettings: {
              create: { markup: 2.5, taxEnabled: false, taxRate: 0.14975 },
            },
          },
          select: { id: true, name: true, jobNumber: true, clientFirstName: true, clientLastName: true, clientEmail: true, clientPhone: true, clientAddress: true },
        });

        let serviceDate: Date | null = null;
        let dayStart: Date | null = null;
        let dayEnd: Date | null = null;
        if (p.serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(p.serviceDate)) {
          const [y, m, d] = p.serviceDate.split("-").map(Number);
          if (y && m && d) {
            dayStart = new Date(y, m - 1, d);
            dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
            serviceDate = dayStart;
          }
        }

        let timeOfArrival: Date | null = null;
        if (serviceDate && p.serviceTime && /^\d{1,2}:\d{2}$/.test(p.serviceTime.trim())) {
          const [hh, mm] = p.serviceTime.split(":").map(Number);
          timeOfArrival = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate(), hh, mm, 0, 0);
        }

        const serviceCall = await prisma.serviceCall.create({
          data: {
            projectId: project.id,
            jobNumber: project.jobNumber,
            clientName: p.clientName ?? null,
            address: p.clientAddress ?? null,
            clientPhone: p.clientPhone ?? null,
            clientEmail: p.clientEmail ?? null,
            serviceDate,
            timeOfArrival,
            reasonForService: p.reasonForService ?? null,
            notes: [p.notes, p.rawMessage ? `Raw: ${p.rawMessage}` : null].filter(Boolean).join("\n\n") || null,
            technicianName: p.technicianName ?? null,
            serviceCallType: p.serviceCallType?.length ? JSON.stringify(p.serviceCallType) : null,
          },
        });

        const items = p.workItems ?? [];
        for (const item of items) {
          if (item?.description?.trim()) {
            await prisma.serviceCallItem.create({
              data: {
                serviceCallId: serviceCall.id,
                description: item.description.trim(),
                quantity: item.quantity ?? null,
                providedBy: item.providedBy ?? null,
              },
            });
          }
        }

        if (dayStart && dayEnd) {
          const maxSort = await prisma.dayPlanItem.aggregate({
            where: { planDate: { gte: dayStart, lte: dayEnd } },
            _max: { sortOrder: true },
          });
          await prisma.dayPlanItem.create({
            data: {
              planDate: dayStart,
              sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
              type: "service_call",
              serviceCallId: serviceCall.id,
            },
          });
        }

        result = {
          status: "draft_project_and_service_call_created",
          projectId: project.id,
          serviceCallId: serviceCall.id,
          scheduled: Boolean(serviceDate),
        };
        break;
      }

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

        // Batch: payload.items = [ { boardId, itemId, overrides? }, ... ]; single: payload.boardId + payload.itemId
        const entries: {
          boardId: string;
          itemId: string;
          overrides?: {
            jobNumber?: string | null;
            clientName?: string | null;
            address?: string | null;
            notes?: string | null;
          };
        }[] = payload.items
          ? (payload.items as any[])
          : payload.boardId && payload.itemId
            ? [{ boardId: payload.boardId as string, itemId: payload.itemId as string }]
            : [];

        if (entries.length === 0) {
          return NextResponse.json({ error: "No Monday items to create", details: "Payload missing items or boardId/itemId" }, { status: 400 });
        }

        const created: { id: string; name: string }[] = [];
        const errors: string[] = [];

        // Scale guardrails: keep the approval endpoint reliable for big Monday batches.
        // If user selects 50+ items, we process in chunks and may return a partial result on timeout.
        const startedAt = Date.now();
        const MAX_MS = 25_000; // keep under common serverless timeouts
        const CHUNK_SIZE = 25;
        const MAX_ITEMS = 250;
        const list = entries.slice(0, MAX_ITEMS);
        const skipped = entries.length > MAX_ITEMS ? entries.length - MAX_ITEMS : 0;

        for (let i = 0; i < list.length; i++) {
          const { boardId, itemId, overrides } = list[i] as (typeof entries)[number];
          try {
            const mapped = await getMondayItemAsProject(key, boardId, itemId);
            const name = mapped.name?.trim() || "New project";
            const jobRaw = overrides?.jobNumber ?? mapped.jobNumber;
            const jobNumber = typeof jobRaw === "string" && jobRaw.trim() ? jobRaw.trim() : null;
            const clientRaw = overrides?.clientName ?? mapped.clientName;
            const clientName = typeof clientRaw === "string" && clientRaw.trim() ? clientRaw.trim() : null;
            const notes = overrides?.notes ?? mapped.notes ?? null;
            const project = await prisma.project.create({
              data: {
                name,
                type: "custom",
                types: "custom",
                jobNumber,
                notes,
                isDraft: true,
                isDone: false,
                clientFirstName: clientName ? clientName.split(/\s+/)[0] ?? null : null,
                clientLastName: clientName ? clientName.split(/\s+/).slice(1).join(" ") || null : null,
                clientAddress: typeof overrides?.address === "string" && overrides.address.trim() ? overrides.address.trim() : null,
              },
            });
            created.push({ id: project.id, name: project.name });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${itemId}: ${msg}`);
          }

          // Soft “heartbeat” checkpoints every CHUNK_SIZE items
          if ((i + 1) % CHUNK_SIZE === 0) {
            if (Date.now() - startedAt > MAX_MS) {
              const remaining = list.length - (i + 1);
              errors.push(
                `batch_timeout: Stopped after ${(i + 1)} item(s) to avoid timeout. ${remaining} item(s) remain; run again to continue.`
              );
              break;
            }
          }
        }

        if (skipped > 0) {
          errors.push(
            `batch_limit: ${skipped} item(s) were not attempted (max ${MAX_ITEMS} per approval). Run again with the remaining items.`
          );
        }

        result = {
          status: created.length ? "project_created" : "failed",
          projectId: created[0]?.id ?? null,
          projectIds: created.map((p) => p.id),
          count: created.length,
          total: list.length,
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

        const activating = status === "active" || status === "done";
        if (activating) {
          const pre = await prisma.project.findUnique({
            where: { id: resolvedId },
            select: {
              isDraft: true,
              jobNumber: true,
              clientId: true,
              clientFirstName: true,
              clientLastName: true,
              targetDate: true,
              _count: { select: { projectItems: true } },
            },
          });
          if (pre?.isDraft) {
            const { ready, missing } = computeReadinessCheck({
              jobNumber: pre.jobNumber,
              clientId: pre.clientId,
              clientFirstName: pre.clientFirstName,
              clientLastName: pre.clientLastName,
              targetDate: pre.targetDate,
              projectItemCount: pre._count.projectItems,
            });
            if (!ready && process.env.READINESS_GATE_STRICT === "true") {
              await logAudit(resolvedId, "readiness_blocked", JSON.stringify({ missing }));
              return NextResponse.json({ error: "readiness_check_failed", missing }, { status: 400 });
            }
          }
        }

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
