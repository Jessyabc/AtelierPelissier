import {
  applyDiscount,
  autoCalculateHardware,
  calculateDoorCost,
  calculateKitchenSalesBreakdown,
  calculateTotalCost,
  lookupFabricationHours,
} from "@/lib/kitchen-pricing/engine";
import { staticKitchenRoomDefaults } from "@/lib/kitchen-pricing/roomDefaults";

describe("kitchen pricing engine", () => {
  it("enforces manufacturer minimum door sqft", () => {
    const cost = calculateDoorCost(10, 10, 1, "richelieu_panexel", "slab");
    expect(cost.normalizedSqFtPerUnit).toBe(2.5);
    expect(cost.unitCost).toBe(67.5);
    expect(cost.totalCost).toBe(67.5);
  });

  it("auto-calculates hardware boundaries for corner base cabinet", () => {
    const hardware = autoCalculateHardware("corner_base", "corner_doors", 2, 1);
    expect(hardware.standardHinges.min).toBe(4);
    expect(hardware.pattes.min).toBe(6);
    expect(hardware.handles.max).toBe(1);
  });

  it("returns null fabrication hours for unknown config", () => {
    const hours = lookupFabricationHours("custom", "custom");
    expect(hours).toBeNull();
  });

  it("calculates full project totals and sales breakdown", () => {
    const payload = {
      roomDefaults: staticKitchenRoomDefaults(),
      cabinets: [
        {
          cabinetType: "base" as const,
          configuration: "doors_and_drawers" as const,
          doors: [
            {
              widthInches: 18,
              heightInches: 32,
              quantity: 2,
              manufacturerId: "richelieu_agt" as const,
              styleId: "shaker_3_4" as const,
            },
          ],
          drawers: [{ drawerSystemId: "blum_merivo_box" as const, quantity: 2 }],
          hardware: {
            standardHinges: 4,
            verticalHinges: 0,
            handleTypeId: "standard_handle" as const,
            handleQuantity: 2,
            pattes: 4,
            ledQuantity: 0,
            wasteBinQuantity: 0,
          },
          cabinetBoxMaterialId: "melamine_white" as const,
          cabinetBoxQuantity: 1,
          manualFabricationHours: null,
        },
      ],
      includeInstallation: true,
      installation: {
        baseCabinetQty: 1,
        wallCabinetQty: 0,
        pantryQty: 0,
        finishingPanelQty: 0,
      },
      includeDelivery: true,
      deliveryCost: 500,
      multiplier: 2.5,
      discountPercent: 10,
      discountReason: "test",
    };

    const totals = calculateTotalCost(payload);
    expect(totals.materialsSubtotal).toBe(472.2);
    expect(totals.fabricationSubtotal).toBe(90);
    expect(totals.installationSubtotal).toBe(75);
    expect(totals.deliverySubtotal).toBe(500);
    expect(totals.totalCost).toBe(1137.2);

    const sales = calculateKitchenSalesBreakdown(payload);
    expect(sales.salesPriceRaw).toBe(2843);
    expect(sales.discountAmount).toBe(284.3);
    expect(sales.finalSalesPrice).toBe(2558.7);
  });

  it("caps discount at 10 percent", () => {
    expect(applyDiscount(1000, 99)).toBe(900);
  });
});
