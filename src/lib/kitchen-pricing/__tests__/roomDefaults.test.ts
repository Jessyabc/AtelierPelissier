import { CABINET_DEFAULTS } from "@/lib/ingredients/types";
import {
  mergeKitchenRoomDefaults,
  usableBaseCabinetOpeningInches,
} from "@/lib/kitchen-pricing/roomDefaults";

describe("mergeKitchenRoomDefaults", () => {
  it("uses shop standards when nothing stored", () => {
    const m = mergeKitchenRoomDefaults(null, CABINET_DEFAULTS);
    expect(m.baseCabinetHeightInches).toBe(34.75);
    expect(m.baseCabinetDepthInches).toBe(23.375);
    expect(m.ceilingHeightInches).toBe(96);
  });

  it("overrides only provided numeric fields", () => {
    const m = mergeKitchenRoomDefaults({ ceilingHeightInches: 108 }, CABINET_DEFAULTS);
    expect(m.ceilingHeightInches).toBe(108);
    expect(m.baseCabinetHeightInches).toBe(34.75);
  });
});

describe("usableBaseCabinetOpeningInches", () => {
  it("subtracts kick from base height", () => {
    expect(
      usableBaseCabinetOpeningInches({
        ceilingHeightInches: 96,
        baseCabinetHeightInches: 34.75,
        baseCabinetDepthInches: 23.375,
        kickplateHeightInches: 4.75,
        topCabinetSilenceInches: 3,
      })
    ).toBe(30);
  });
});
