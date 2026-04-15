import {
  KITCHEN_CABINET_BOX_MATERIALS,
  KITCHEN_CABINET_CONFIG_HOURS,
  KITCHEN_DELIVERY_FALLBACK_COST,
  KITCHEN_DOOR_MANUFACTURERS,
  KITCHEN_DRAWER_SYSTEMS,
  KITCHEN_FABRICATION_HOURLY_RATE,
  KITCHEN_HARDWARE_UNIT_COSTS,
  KITCHEN_INSTALLATION_RATES,
  KITCHEN_MAX_DISCOUNT_PERCENT,
} from "@/config/kitchenPricingBuilder";
import type {
  KitchenCabinetConfiguration,
  KitchenCabinetInput,
  KitchenCabinetType,
  KitchenCostBreakdown,
  KitchenDoorCostBreakdown,
  KitchenDoorManufacturerId,
  KitchenDoorStyleId,
  KitchenHardwareAutoResult,
  KitchenProjectPricingInput,
  KitchenSalesBreakdown,
} from "@/lib/kitchen-pricing/types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateDoorCost(
  widthInches: number,
  heightInches: number,
  quantity: number,
  manufacturerId: KitchenDoorManufacturerId,
  styleId: KitchenDoorStyleId
): KitchenDoorCostBreakdown {
  const manufacturer = KITCHEN_DOOR_MANUFACTURERS[manufacturerId];
  const costPerSqFt = manufacturer.styles[styleId];
  const rawSqFtPerUnit = (widthInches * heightInches) / 144;
  const normalizedSqFtPerUnit = Math.max(rawSqFtPerUnit, manufacturer.minimumSqFt);
  const unitCost = round2(normalizedSqFtPerUnit * costPerSqFt);
  const totalCost = round2(unitCost * quantity);

  return {
    normalizedSqFtPerUnit: round2(normalizedSqFtPerUnit),
    unitCost,
    totalCost,
  };
}

export function autoCalculateHardware(
  cabinetType: KitchenCabinetType,
  configuration: KitchenCabinetConfiguration,
  doorCount: number,
  drawerCount: number
): KitchenHardwareAutoResult {
  const isCorner = cabinetType === "corner_base" || cabinetType === "corner_wall" || configuration === "corner_doors";
  const standardMin = isCorner ? 4 : doorCount > 0 ? doorCount * 2 : 0;
  const pattesMin = cabinetType === "corner_base" ? 6 : cabinetType === "base" || cabinetType === "pantry" ? 4 : 0;
  const handleRecommended = drawerCount;
  const ledMax = 4;
  const wasteBinMax = 2;

  return {
    standardHinges: {
      min: standardMin,
      max: standardMin + 2,
      recommended: standardMin,
    },
    pattes: {
      min: pattesMin,
      max: pattesMin + 4,
      recommended: pattesMin,
    },
    handles: {
      min: 0,
      max: drawerCount,
      recommended: handleRecommended,
    },
    verticalHinges: {
      min: 0,
      max: null,
      recommended: 0,
    },
    led: {
      min: 0,
      max: ledMax,
      recommended: 0,
    },
    wasteBin: {
      min: 0,
      max: wasteBinMax,
      recommended: 0,
    },
  };
}

export function lookupFabricationHours(
  cabinetType: KitchenCabinetType,
  configuration: KitchenCabinetConfiguration
): number | null {
  const key = `${cabinetType}_${configuration}`;
  const hours = KITCHEN_CABINET_CONFIG_HOURS[key];
  return hours ?? null;
}

function calculateCabinetMaterialsCost(cabinet: KitchenCabinetInput): number {
  let total = 0;

  for (const door of cabinet.doors) {
    total += calculateDoorCost(
      door.widthInches,
      door.heightInches,
      door.quantity,
      door.manufacturerId,
      door.styleId
    ).totalCost;
  }

  for (const drawer of cabinet.drawers) {
    total += round2(KITCHEN_DRAWER_SYSTEMS[drawer.drawerSystemId] * drawer.quantity);
  }

  total += round2(KITCHEN_CABINET_BOX_MATERIALS[cabinet.cabinetBoxMaterialId] * cabinet.cabinetBoxQuantity);

  total += round2(KITCHEN_HARDWARE_UNIT_COSTS.standard_hinge * cabinet.hardware.standardHinges);
  total += round2(KITCHEN_HARDWARE_UNIT_COSTS.vertical_hinge * cabinet.hardware.verticalHinges);
  total += round2(KITCHEN_HARDWARE_UNIT_COSTS[cabinet.hardware.handleTypeId] * cabinet.hardware.handleQuantity);
  total += round2(KITCHEN_HARDWARE_UNIT_COSTS.patte * cabinet.hardware.pattes);
  total += round2(KITCHEN_HARDWARE_UNIT_COSTS.led * cabinet.hardware.ledQuantity);
  total += round2(KITCHEN_HARDWARE_UNIT_COSTS.waste_bin * cabinet.hardware.wasteBinQuantity);

  return round2(total);
}

function calculateCabinetFabricationHours(cabinet: KitchenCabinetInput): number {
  const lookedUp = lookupFabricationHours(cabinet.cabinetType, cabinet.configuration);
  if (lookedUp != null) return lookedUp;
  return cabinet.manualFabricationHours ?? 0;
}

export function calculateTotalCost(input: KitchenProjectPricingInput): KitchenCostBreakdown {
  const materialsSubtotal = round2(
    input.cabinets.reduce((sum, cabinet) => sum + calculateCabinetMaterialsCost(cabinet), 0)
  );

  const totalHours = input.cabinets.reduce(
    (sum, cabinet) => sum + calculateCabinetFabricationHours(cabinet),
    0
  );
  const fabricationSubtotal = round2(totalHours * KITCHEN_FABRICATION_HOURLY_RATE);

  const installationSubtotal = input.includeInstallation
    ? round2(
        input.installation.baseCabinetQty * KITCHEN_INSTALLATION_RATES.base_install +
          input.installation.wallCabinetQty * KITCHEN_INSTALLATION_RATES.wall_install +
          input.installation.pantryQty * KITCHEN_INSTALLATION_RATES.pantry_install +
          input.installation.finishingPanelQty * KITCHEN_INSTALLATION_RATES.panel_install
      )
    : 0;

  const deliverySubtotal = input.includeDelivery
    ? round2(input.deliveryCost ?? KITCHEN_DELIVERY_FALLBACK_COST)
    : 0;

  const totalCost = round2(materialsSubtotal + fabricationSubtotal + installationSubtotal + deliverySubtotal);

  return {
    materialsSubtotal,
    fabricationSubtotal,
    installationSubtotal,
    deliverySubtotal,
    totalCost,
  };
}

export function calculateSalesPrice(totalCost: number, multiplier: number): number {
  return round2(totalCost * multiplier);
}

export function applyDiscount(salesPrice: number, discountPercent: number): number {
  const boundedDiscount = clamp(discountPercent, 0, KITCHEN_MAX_DISCOUNT_PERCENT);
  const discountAmount = round2((salesPrice * boundedDiscount) / 100);
  return round2(salesPrice - discountAmount);
}

export function calculateKitchenSalesBreakdown(input: KitchenProjectPricingInput): KitchenSalesBreakdown {
  const totals = calculateTotalCost(input);
  const boundedDiscount = clamp(input.discountPercent, 0, KITCHEN_MAX_DISCOUNT_PERCENT);
  const salesPriceRaw = calculateSalesPrice(totals.totalCost, input.multiplier);
  const finalSalesPrice = applyDiscount(salesPriceRaw, boundedDiscount);

  return {
    totalCost: totals.totalCost,
    multiplier: input.multiplier,
    salesPriceRaw,
    discountPercent: boundedDiscount,
    discountAmount: round2(salesPriceRaw - finalSalesPrice),
    finalSalesPrice,
  };
}
