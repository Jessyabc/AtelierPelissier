import type { Prisma, PrismaClient } from "@prisma/client";
import type { KitchenBuilderPayloadValidated } from "@/lib/validators";
import { calculateKitchenSalesBreakdown, calculateTotalCost } from "@/lib/kitchen-pricing/engine";
import type { KitchenApprovalStatus } from "@/lib/kitchen-pricing/types";

const KITCHEN_ESTIMATE_CATEGORIES = [
  "kitchen_materials",
  "kitchen_fabrication",
  "kitchen_installation",
  "kitchen_delivery",
] as const;

type PrismaTx = Prisma.TransactionClient | PrismaClient;

type SaveKitchenBuilderOptions = {
  approvalStatus?: KitchenApprovalStatus;
  approvalReason?: string | null;
  submittedByRole?: string | null;
  approvedByRole?: string | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
};

async function syncKitchenEstimateCostLines(
  tx: PrismaTx,
  projectId: string,
  payload: KitchenBuilderPayloadValidated
) {
  const totals = calculateTotalCost(payload);
  const lineItems = [
    { category: "kitchen_materials", amount: totals.materialsSubtotal },
    { category: "kitchen_fabrication", amount: totals.fabricationSubtotal },
    { category: "kitchen_installation", amount: totals.installationSubtotal },
    { category: "kitchen_delivery", amount: totals.deliverySubtotal },
  ];

  await tx.costLine.deleteMany({
    where: { projectId, kind: "estimate", category: { in: [...KITCHEN_ESTIMATE_CATEGORIES] } },
  });

  await tx.costLine.createMany({
    data: lineItems.map((line) => ({
      projectId,
      kind: "estimate",
      category: line.category,
      amount: line.amount,
    })),
  });
}

export async function saveKitchenBuilderState(
  tx: PrismaTx,
  projectId: string,
  payload: KitchenBuilderPayloadValidated,
  options: SaveKitchenBuilderOptions = {}
) {
  const current = await tx.kitchenPricingProject.findUnique({
    where: { projectId },
    select: {
      id: true,
      approvalStatus: true,
      approvalReason: true,
      submittedAt: true,
      approvedAt: true,
      submittedByRole: true,
      approvedByRole: true,
    },
  });

  const projectRow = await tx.kitchenPricingProject.upsert({
    where: { projectId },
    create: {
      projectId,
      roomDefaults: payload.roomDefaults,
      includeInstallation: payload.includeInstallation,
      includeDelivery: payload.includeDelivery,
      deliveryCost: payload.deliveryCost ?? null,
      multiplier: payload.multiplier,
      discountPercent: payload.discountPercent,
      discountReason: payload.discountReason ?? null,
      approvalStatus: options.approvalStatus ?? current?.approvalStatus ?? "not_required",
      approvalReason: options.approvalReason ?? current?.approvalReason ?? null,
      submittedByRole: options.submittedByRole ?? current?.submittedByRole ?? null,
      approvedByRole: options.approvedByRole ?? current?.approvedByRole ?? null,
      submittedAt: options.submittedAt ?? current?.submittedAt ?? null,
      approvedAt: options.approvedAt ?? current?.approvedAt ?? null,
    },
    update: {
      roomDefaults: payload.roomDefaults,
      includeInstallation: payload.includeInstallation,
      includeDelivery: payload.includeDelivery,
      deliveryCost: payload.deliveryCost ?? null,
      multiplier: payload.multiplier,
      discountPercent: payload.discountPercent,
      discountReason: payload.discountReason ?? null,
      approvalStatus: options.approvalStatus ?? undefined,
      approvalReason: options.approvalReason ?? undefined,
      submittedByRole: options.submittedByRole ?? undefined,
      approvedByRole: options.approvedByRole ?? undefined,
      submittedAt: options.submittedAt ?? undefined,
      approvedAt: options.approvedAt ?? undefined,
    },
    select: { id: true },
  });

  const existingCabinets = await tx.kitchenPricingCabinet.findMany({
    where: { kitchenPricingProjectId: projectRow.id },
    select: { id: true },
  });
  const existingCabinetIds = existingCabinets.map((row) => row.id);

  if (existingCabinetIds.length > 0) {
    await tx.kitchenPricingDoorSpec.deleteMany({
      where: { kitchenPricingCabinetId: { in: existingCabinetIds } },
    });
    await tx.kitchenPricingDrawerSpec.deleteMany({
      where: { kitchenPricingCabinetId: { in: existingCabinetIds } },
    });
    await tx.kitchenPricingHardware.deleteMany({
      where: { kitchenPricingCabinetId: { in: existingCabinetIds } },
    });
    await tx.kitchenPricingCabinet.deleteMany({
      where: { id: { in: existingCabinetIds } },
    });
  }

  for (let cabinetIndex = 0; cabinetIndex < payload.cabinets.length; cabinetIndex += 1) {
    const cabinet = payload.cabinets[cabinetIndex];
    const createdCabinet = await tx.kitchenPricingCabinet.create({
      data: {
        kitchenPricingProjectId: projectRow.id,
        sortOrder: cabinetIndex,
        cabinetType: cabinet.cabinetType,
        configuration: cabinet.configuration,
        cabinetBoxMaterialId: cabinet.cabinetBoxMaterialId,
        cabinetBoxQuantity: cabinet.cabinetBoxQuantity,
        manualFabricationHours: cabinet.manualFabricationHours ?? null,
      },
      select: { id: true },
    });

    if (cabinet.doors.length > 0) {
      await tx.kitchenPricingDoorSpec.createMany({
        data: cabinet.doors.map((door, doorIndex) => ({
          kitchenPricingCabinetId: createdCabinet.id,
          sortOrder: doorIndex,
          widthInches: door.widthInches,
          heightInches: door.heightInches,
          quantity: door.quantity,
          manufacturerId: door.manufacturerId,
          styleId: door.styleId,
        })),
      });
    }

    if (cabinet.drawers.length > 0) {
      await tx.kitchenPricingDrawerSpec.createMany({
        data: cabinet.drawers.map((drawer, drawerIndex) => ({
          kitchenPricingCabinetId: createdCabinet.id,
          sortOrder: drawerIndex,
          drawerSystemId: drawer.drawerSystemId,
          quantity: drawer.quantity,
        })),
      });
    }

    await tx.kitchenPricingHardware.create({
      data: {
        kitchenPricingCabinetId: createdCabinet.id,
        standardHinges: cabinet.hardware.standardHinges,
        verticalHinges: cabinet.hardware.verticalHinges,
        handleTypeId: cabinet.hardware.handleTypeId,
        handleQuantity: cabinet.hardware.handleQuantity,
        pattes: cabinet.hardware.pattes,
        ledQuantity: cabinet.hardware.ledQuantity,
        wasteBinQuantity: cabinet.hardware.wasteBinQuantity,
      },
    });
  }

  await tx.kitchenPricingInstallationItem.deleteMany({
    where: { kitchenPricingProjectId: projectRow.id },
  });

  const installationItems = [
    { installTypeId: "base_install", quantity: payload.installation.baseCabinetQty },
    { installTypeId: "wall_install", quantity: payload.installation.wallCabinetQty },
    { installTypeId: "pantry_install", quantity: payload.installation.pantryQty },
    { installTypeId: "panel_install", quantity: payload.installation.finishingPanelQty },
  ].filter((row) => row.quantity > 0);

  if (installationItems.length > 0) {
    await tx.kitchenPricingInstallationItem.createMany({
      data: installationItems.map((row) => ({
        kitchenPricingProjectId: projectRow.id,
        installTypeId: row.installTypeId,
        quantity: row.quantity,
      })),
    });
  }

  await syncKitchenEstimateCostLines(tx, projectId, payload);

  const totals = calculateTotalCost(payload);
  const sales = calculateKitchenSalesBreakdown(payload);

  return {
    totals,
    sales,
  };
}
