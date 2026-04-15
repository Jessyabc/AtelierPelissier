export type KitchenCabinetType =
  | "base"
  | "wall"
  | "pantry"
  | "corner_base"
  | "corner_wall"
  | "custom";

export type KitchenCabinetConfiguration =
  | "doors_only"
  | "doors_and_drawers"
  | "drawers_only"
  | "corner_doors"
  | "custom";

export type KitchenDoorManufacturerId = "richelieu_agt" | "richelieu_panexel";
export type KitchenDoorStyleId = "shaker_3_4" | "slab" | "shaker_2_1_4";

export type KitchenDrawerSystemId =
  | "rocheleau_basic"
  | "blum_merivo_box"
  | "blum_push_slow_close"
  | "rocheleau_light";

export type KitchenHandleTypeId =
  | "no_handle"
  | "45_degree"
  | "finger_grab"
  | "tip_handle"
  | "standard_handle";

export type KitchenCabinetBoxMaterialId = "melamine_white" | "melamine_grey";

export type KitchenApprovalStatus =
  | "not_required"
  | "required"
  | "pending"
  | "approved"
  | "rejected";

export type KitchenDoorInput = {
  widthInches: number;
  heightInches: number;
  quantity: number;
  manufacturerId: KitchenDoorManufacturerId;
  styleId: KitchenDoorStyleId;
};

export type KitchenDrawerInput = {
  drawerSystemId: KitchenDrawerSystemId;
  quantity: number;
};

export type KitchenHardwareInput = {
  standardHinges: number;
  verticalHinges: number;
  handleTypeId: KitchenHandleTypeId;
  handleQuantity: number;
  pattes: number;
  ledQuantity: number;
  wasteBinQuantity: number;
};

export type KitchenCabinetInput = {
  cabinetType: KitchenCabinetType;
  configuration: KitchenCabinetConfiguration;
  doors: KitchenDoorInput[];
  drawers: KitchenDrawerInput[];
  hardware: KitchenHardwareInput;
  cabinetBoxMaterialId: KitchenCabinetBoxMaterialId;
  cabinetBoxQuantity: number;
  manualFabricationHours?: number | null;
};

export type KitchenInstallationInput = {
  baseCabinetQty: number;
  wallCabinetQty: number;
  pantryQty: number;
  finishingPanelQty: number;
};

export type KitchenProjectPricingInput = {
  cabinets: KitchenCabinetInput[];
  includeInstallation: boolean;
  installation: KitchenInstallationInput;
  includeDelivery: boolean;
  deliveryCost?: number | null;
  multiplier: number;
  discountPercent: number;
  discountReason?: string | null;
};

export type KitchenHardwareAutoResult = {
  standardHinges: { min: number; max: number; recommended: number };
  pattes: { min: number; max: number; recommended: number };
  handles: { min: number; max: number; recommended: number };
  verticalHinges: { min: number; max: null; recommended: number };
  led: { min: number; max: number; recommended: number };
  wasteBin: { min: number; max: number; recommended: number };
};

export type KitchenDoorCostBreakdown = {
  normalizedSqFtPerUnit: number;
  unitCost: number;
  totalCost: number;
};

export type KitchenCostBreakdown = {
  materialsSubtotal: number;
  fabricationSubtotal: number;
  installationSubtotal: number;
  deliverySubtotal: number;
  totalCost: number;
};

export type KitchenSalesBreakdown = {
  totalCost: number;
  multiplier: number;
  salesPriceRaw: number;
  discountPercent: number;
  discountAmount: number;
  finalSalesPrice: number;
};
