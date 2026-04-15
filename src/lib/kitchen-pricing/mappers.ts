import { DEFAULT_KITCHEN_MARKUP, KITCHEN_DELIVERY_FALLBACK_COST } from "@/config/kitchenPricingBuilder";
import type { KitchenBuilderPayloadValidated } from "@/lib/validators";

type KitchenProjectRecord = {
  includeInstallation: boolean;
  includeDelivery: boolean;
  deliveryCost: number | null;
  multiplier: number;
  discountPercent: number;
  discountReason: string | null;
  cabinets: Array<{
    cabinetType: string;
    configuration: string;
    cabinetBoxMaterialId: string;
    cabinetBoxQuantity: number;
    manualFabricationHours: number | null;
    doorSpecs: Array<{
      widthInches: number;
      heightInches: number;
      quantity: number;
      manufacturerId: string;
      styleId: string;
    }>;
    drawerSpecs: Array<{
      drawerSystemId: string;
      quantity: number;
    }>;
    hardware: {
      standardHinges: number;
      verticalHinges: number;
      handleTypeId: string;
      handleQuantity: number;
      pattes: number;
      ledQuantity: number;
      wasteBinQuantity: number;
    } | null;
  }>;
  installationItems: Array<{
    installTypeId: string;
    quantity: number;
  }>;
};

export function buildDefaultKitchenBuilderPayload(): KitchenBuilderPayloadValidated {
  return {
    cabinets: [],
    includeInstallation: false,
    installation: {
      baseCabinetQty: 0,
      wallCabinetQty: 0,
      pantryQty: 0,
      finishingPanelQty: 0,
    },
    includeDelivery: true,
    deliveryCost: KITCHEN_DELIVERY_FALLBACK_COST,
    multiplier: DEFAULT_KITCHEN_MARKUP,
    discountPercent: 0,
    discountReason: null,
  };
}

export function mapKitchenProjectToPayload(
  record: KitchenProjectRecord | null | undefined
): KitchenBuilderPayloadValidated {
  if (!record) {
    return buildDefaultKitchenBuilderPayload();
  }

  const installationBase = {
    baseCabinetQty: 0,
    wallCabinetQty: 0,
    pantryQty: 0,
    finishingPanelQty: 0,
  };

  for (const item of record.installationItems) {
    if (item.installTypeId === "base_install") installationBase.baseCabinetQty = item.quantity;
    if (item.installTypeId === "wall_install") installationBase.wallCabinetQty = item.quantity;
    if (item.installTypeId === "pantry_install") installationBase.pantryQty = item.quantity;
    if (item.installTypeId === "panel_install") installationBase.finishingPanelQty = item.quantity;
  }

  return {
    cabinets: record.cabinets.map((cabinet) => ({
      cabinetType: cabinet.cabinetType as KitchenBuilderPayloadValidated["cabinets"][number]["cabinetType"],
      configuration:
        cabinet.configuration as KitchenBuilderPayloadValidated["cabinets"][number]["configuration"],
      doors: cabinet.doorSpecs.map((door) => ({
        widthInches: door.widthInches,
        heightInches: door.heightInches,
        quantity: door.quantity,
        manufacturerId:
          door.manufacturerId as KitchenBuilderPayloadValidated["cabinets"][number]["doors"][number]["manufacturerId"],
        styleId: door.styleId as KitchenBuilderPayloadValidated["cabinets"][number]["doors"][number]["styleId"],
      })),
      drawers: cabinet.drawerSpecs.map((drawer) => ({
        drawerSystemId:
          drawer.drawerSystemId as KitchenBuilderPayloadValidated["cabinets"][number]["drawers"][number]["drawerSystemId"],
        quantity: drawer.quantity,
      })),
      hardware: {
        standardHinges: cabinet.hardware?.standardHinges ?? 0,
        verticalHinges: cabinet.hardware?.verticalHinges ?? 0,
        handleTypeId:
          (cabinet.hardware?.handleTypeId as KitchenBuilderPayloadValidated["cabinets"][number]["hardware"]["handleTypeId"]) ??
          "standard_handle",
        handleQuantity: cabinet.hardware?.handleQuantity ?? 0,
        pattes: cabinet.hardware?.pattes ?? 0,
        ledQuantity: cabinet.hardware?.ledQuantity ?? 0,
        wasteBinQuantity: cabinet.hardware?.wasteBinQuantity ?? 0,
      },
      cabinetBoxMaterialId:
        cabinet.cabinetBoxMaterialId as KitchenBuilderPayloadValidated["cabinets"][number]["cabinetBoxMaterialId"],
      cabinetBoxQuantity: cabinet.cabinetBoxQuantity,
      manualFabricationHours: cabinet.manualFabricationHours ?? null,
    })),
    includeInstallation: record.includeInstallation,
    installation: installationBase,
    includeDelivery: record.includeDelivery,
    deliveryCost: record.deliveryCost ?? KITCHEN_DELIVERY_FALLBACK_COST,
    multiplier: record.multiplier,
    discountPercent: record.discountPercent,
    discountReason: record.discountReason ?? null,
  };
}
