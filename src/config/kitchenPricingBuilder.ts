export const DEFAULT_KITCHEN_MARKUP = 2.5;
export const DISTRIBUTION_KITCHEN_MARKUP = 1.65;
export const LARGE_VOLUME_KITCHEN_MARKUP = 2.1;

export const KITCHEN_MULTIPLIER_PRESETS = [
  DEFAULT_KITCHEN_MARKUP,
  DISTRIBUTION_KITCHEN_MARKUP,
  LARGE_VOLUME_KITCHEN_MARKUP,
] as const;

export const KITCHEN_MAX_DISCOUNT_PERCENT = 10;
export const KITCHEN_DELIVERY_FALLBACK_COST = 500;
export const KITCHEN_FABRICATION_HOURLY_RATE = 45;

export const KITCHEN_CABINET_CONFIG_HOURS: Record<string, number> = {
  base_doors_only: 1,
  base_doors_and_drawers: 2,
  base_drawers_only: 2,
  base_corner_doors: 3,
  wall_doors_only: 1,
  wall_corner_doors: 3,
  pantry_doors_only: 3,
  pantry_doors_and_drawers: 4,
};

export const KITCHEN_DOOR_MANUFACTURERS = {
  richelieu_agt: {
    minimumSqFt: 2.0,
    styles: {
      shaker_3_4: 33,
      slab: 27,
      shaker_2_1_4: 28,
    },
  },
  richelieu_panexel: {
    minimumSqFt: 2.5,
    styles: {
      shaker_3_4: 33,
      slab: 27,
      shaker_2_1_4: 28,
    },
  },
} as const;

export const KITCHEN_DRAWER_SYSTEMS = {
  rocheleau_basic: 35,
  blum_merivo_box: 65,
  blum_push_slow_close: 60,
  rocheleau_light: 45,
} as const;

export const KITCHEN_CABINET_BOX_MATERIALS = {
  melamine_white: 35,
  melamine_grey: 54,
} as const;

export const KITCHEN_HARDWARE_UNIT_COSTS = {
  standard_hinge: 4,
  vertical_hinge: 20,
  no_handle: 0,
  "45_degree": 10,
  finger_grab: 10,
  tip_handle: 10,
  standard_handle: 10,
  patte: 1.8,
  led: 75,
  waste_bin: 180,
  edgebanding: 100,
  screws: 50,
} as const;

export const KITCHEN_INSTALLATION_RATES = {
  base_install: 75,
  wall_install: 75,
  pantry_install: 100,
  panel_install: 25,
} as const;
