import { kitchenBuilderPayloadSchema, vanityInputsSchema } from "@/lib/validators";
import { staticKitchenRoomDefaults } from "@/lib/kitchen-pricing/roomDefaults";

const minimalKitchenCabinet = {
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
};

describe("TBD payload fields (backward-compatible parsing)", () => {
  it("kitchen schema does not coerce omitted installationTbd/deliveryTbd to false", () => {
    const parsed = kitchenBuilderPayloadSchema.safeParse({
      cabinets: [minimalKitchenCabinet],
      roomDefaults: staticKitchenRoomDefaults(),
      installation: {
        baseCabinetQty: 0,
        wallCabinetQty: 0,
        pantryQty: 0,
        finishingPanelQty: 0,
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.installationTbd).toBeUndefined();
    expect(parsed.data.deliveryTbd).toBeUndefined();
  });

  it("vanity schema does not coerce omitted countertopTbd to false", () => {
    const parsed = vanityInputsSchema.safeParse({ width: 36, depth: 22, countertop: true });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.countertopTbd).toBeUndefined();
  });
});
