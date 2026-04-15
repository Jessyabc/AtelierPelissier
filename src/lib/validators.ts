import { z } from "zod";

const FRAMING = ["Sides only", "Sides and bottom", "Around", "Frame everything"] as const;
const MOUNTING = ["Freestanding", "Wall-hung", "Custom legs", "Box base"] as const;
const DOOR_STYLE = ["Slab/Flat", "Thin Shaker", "Standard Shaker"] as const;
const SINKS = ["Single", "Double"] as const;
const COUNTERTOP_SINKS = ["Single", "Double", "Single Vessel", "Double Vessel", "None"] as const;
const FAUCET_HOLES = ['4" center', '8" center', "One hole", "No Hole"] as const;

const positiveNumber = z.number().min(0, "Must be ≥ 0");
const widthInches = z.number().min(12).max(120);
const depthInches = z.number().min(12).max(48);
const heightInches = z.number().min(24).max(120);
const nonNegativeInt = z.number().int().min(0);

const projectTypeEnum = z.enum(["vanity", "side_unit", "kitchen", "closet", "commercial", "laundry", "entertainment", "custom"]);

const clientInputSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().max(200).trim().optional(),
  phone: z.string().max(50).trim().optional(),
  phone2: z.string().max(50).trim().optional(),
  address: z.string().max(500).trim().optional(),
});

export const projectStageEnum = z.enum(["quote", "invoiced", "confirmed"]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).trim(),
  types: z.array(projectTypeEnum).min(1, "Select at least one type").default(["vanity"]),
  jobNumber: z.string().max(100).trim().optional(),
  parentProjectId: z.string().cuid().optional().nullable(),
  processTemplateId: z.string().cuid().optional(),
  // Sales lifecycle stage — see nextAction.ts ProjectStage for semantics.
  stage: projectStageEnum.default("confirmed"),
  depositReceivedAt: z.string().optional().nullable(),
  // Client: use existing by ID, or create from inline data
  clientId: z.string().cuid().optional().nullable(),
  client: clientInputSchema.optional(),
  client2Id: z.string().cuid().optional().nullable(),
  client2: clientInputSchema.optional(),
  // Legacy embedded client (when no clientId)
  clientFirstName: z.string().max(100).trim().optional(),
  clientLastName: z.string().max(100).trim().optional(),
  clientEmail: z.string().max(200).trim().optional(),
  clientPhone: z.string().max(50).trim().optional(),
  clientPhone2: z.string().max(50).trim().optional(),
  clientAddress: z.string().max(500).trim().optional(),
  targetDate: z.string().optional().nullable(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    types: z.array(projectTypeEnum).optional(),
    isDraft: z.boolean().optional(),
    isDone: z.boolean().optional(),
    jobNumber: z.string().max(100).trim().optional().nullable(),
    notes: z.string().max(5000).trim().optional().nullable(),
    clientFirstName: z.string().max(100).trim().optional().nullable(),
    clientLastName: z.string().max(100).trim().optional().nullable(),
    clientEmail: z.string().max(200).trim().optional().nullable(),
    clientPhone: z.string().max(50).trim().optional().nullable(),
    clientPhone2: z.string().max(50).trim().optional().nullable(),
    clientAddress: z.string().max(500).trim().optional().nullable(),
    clientId: z.string().cuid().optional().nullable(),
    client2Id: z.string().cuid().optional().nullable(),
    client2: clientInputSchema.optional(),
    processTemplateId: z.string().cuid().optional().nullable(),
    targetDate: z.string().optional().nullable(),
    sellingPrice: z.number().min(0).optional().nullable(),
    blockedReason: z
      .enum([
        "missing_material",
        "waiting_cutlist",
        "waiting_approval",
        "supplier_delay",
        "missing_info",
        "change_order",
      ])
      .optional()
      .nullable(),
    stage: projectStageEnum.optional(),
    depositReceivedAt: z.string().optional().nullable(),
  })
  .refine(
    (data) => !(data.isDraft === true && data.isDone === true),
    { message: "A project cannot be both draft and done", path: ["isDone"] }
  );

const VANITY_SECTION_LAYOUTS = ["doors", "drawer_over_doors", "doors_over_drawer", "all_drawers", "open"] as const;
const KITCHEN_CABINET_TYPES = ["base", "wall", "pantry", "corner_base", "corner_wall", "custom"] as const;
const KITCHEN_CONFIGS = ["doors_only", "doors_and_drawers", "drawers_only", "corner_doors", "custom"] as const;
const KITCHEN_DOOR_MANUFACTURERS = ["richelieu_agt", "richelieu_panexel"] as const;
const KITCHEN_DOOR_STYLES = ["shaker_3_4", "slab", "shaker_2_1_4"] as const;
const KITCHEN_DRAWER_SYSTEMS = [
  "rocheleau_basic",
  "blum_merivo_box",
  "blum_push_slow_close",
  "rocheleau_light",
] as const;
const KITCHEN_HANDLE_TYPES = ["no_handle", "45_degree", "finger_grab", "tip_handle", "standard_handle"] as const;
const KITCHEN_BOX_MATERIALS = ["melamine_white", "melamine_grey"] as const;
const KITCHEN_APPROVAL_STATUS = ["not_required", "required", "pending", "approved", "rejected"] as const;

const vanitySectionSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int().min(0),
  layoutType: z.enum(VANITY_SECTION_LAYOUTS),
  width: z.number().min(1).max(120),
  doors: nonNegativeInt.max(10),
  drawers: nonNegativeInt.max(10),
});

export const vanityInputsSchema = z.object({
  width: widthInches.default(24),
  depth: depthInches.default(22),
  height: z.number().min(12).max(120).optional().nullable(),
  kickplate: z.boolean().default(false),
  framingStyle: z.enum(FRAMING).default("Sides only"),
  mountingStyle: z.enum(MOUNTING).default("Freestanding"),
  drawers: nonNegativeInt.max(20).default(0),
  doors: nonNegativeInt.max(20).default(0),
  thickFrame: z.boolean().default(false),
  numberOfSinks: z.enum(SINKS).default("Single"),
  doorStyle: z.enum(DOOR_STYLE).default("Slab/Flat"),
  countertop: z.boolean().default(false),
  countertopWidth: z.number().min(0).max(240).optional().nullable(),
  countertopDepth: z.number().min(0).max(96).optional().nullable(),
  sinks: z.enum(COUNTERTOP_SINKS).optional().nullable(),
  faucetHoles: z.enum(FAUCET_HOLES).optional().nullable(),
  priceRangePi2: z.number().min(0).max(1000).optional().nullable(),
  sections: z.string().optional().nullable(), // JSON string of VanitySection[]
});

export const sideUnitInputsSchema = z.object({
  width: widthInches.default(18),
  depth: depthInches.default(16),
  height: heightInches.default(72),
  kickplate: z.boolean().default(false),
  framingStyle: z.enum(FRAMING).default("Sides only"),
  mountingStyle: z.enum(MOUNTING).default("Freestanding"),
  drawers: nonNegativeInt.max(20).default(0),
  doors: nonNegativeInt.max(20).default(0),
  thickFrame: z.boolean().default(false),
  doorStyle: z.enum(DOOR_STYLE).default("Slab/Flat"),
  sections: z.string().optional().nullable(), // JSON string of SideUnitSection[]
});

const kitchenDoorSchema = z.object({
  widthInches: z.number().min(1).max(120),
  heightInches: z.number().min(1).max(120),
  quantity: z.number().int().min(1).max(50),
  manufacturerId: z.enum(KITCHEN_DOOR_MANUFACTURERS),
  styleId: z.enum(KITCHEN_DOOR_STYLES),
});

const kitchenDrawerSchema = z.object({
  drawerSystemId: z.enum(KITCHEN_DRAWER_SYSTEMS),
  quantity: z.number().int().min(0).max(20),
});

const kitchenHardwareSchema = z.object({
  standardHinges: z.number().int().min(0).max(50),
  verticalHinges: z.number().int().min(0).max(50),
  handleTypeId: z.enum(KITCHEN_HANDLE_TYPES),
  handleQuantity: z.number().int().min(0).max(50),
  pattes: z.number().int().min(0).max(50),
  ledQuantity: z.number().int().min(0).max(10),
  wasteBinQuantity: z.number().int().min(0).max(10),
});

const kitchenCabinetSchema = z
  .object({
    id: z.string().cuid().optional(),
    cabinetType: z.enum(KITCHEN_CABINET_TYPES),
    configuration: z.enum(KITCHEN_CONFIGS),
    doors: z.array(kitchenDoorSchema).max(12).default([]),
    drawers: z.array(kitchenDrawerSchema).max(12).default([]),
    hardware: kitchenHardwareSchema,
    cabinetBoxMaterialId: z.enum(KITCHEN_BOX_MATERIALS),
    cabinetBoxQuantity: z.number().int().min(1).max(20).default(1),
    manualFabricationHours: z.number().min(0).max(200).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.doors.length === 0 && value.drawers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cabinet must include at least one door or drawer.",
        path: ["doors"],
      });
    }
  });

const kitchenInstallationSchema = z.object({
  baseCabinetQty: z.number().int().min(0).max(200).default(0),
  wallCabinetQty: z.number().int().min(0).max(200).default(0),
  pantryQty: z.number().int().min(0).max(200).default(0),
  finishingPanelQty: z.number().int().min(0).max(200).default(0),
});

export const kitchenBuilderPayloadSchema = z.object({
  cabinets: z.array(kitchenCabinetSchema).max(150),
  includeInstallation: z.boolean().default(false),
  installation: kitchenInstallationSchema,
  includeDelivery: z.boolean().default(true),
  deliveryCost: z.number().min(0).max(100000).nullable().optional(),
  multiplier: z.number().min(1).max(10).default(2.5),
  discountPercent: z.number().min(0).max(10).default(0),
  discountReason: z.string().max(1000).trim().nullable().optional(),
});

export const kitchenBuilderApprovalSchema = z.object({
  status: z.enum(KITCHEN_APPROVAL_STATUS),
  reason: z.string().max(1000).trim().nullable().optional(),
});

export const projectSettingsSchema = z.object({
  markup: z.number().min(1).max(10).default(2.5),
  taxEnabled: z.boolean().default(false),
  taxRate: z.number().min(0).max(1).default(0.14975),
  sheetFormatId: z.string().optional().nullable(),
});

export const costLineSchema = z.object({
  kind: z.enum(["estimate", "actual"]).default("estimate"),
  category: z
    .string()
    .max(100)
    .trim()
    .transform((s) => (s || "misc").toLowerCase().replace(/\s+/g, "_")),
  amount: positiveNumber,
});

export const costLineUpdateSchema = z.object({
  kind: z.enum(["estimate", "actual"]).optional(),
  category: z.string().min(1).max(100).trim().optional(),
  amount: positiveNumber.optional(),
});

export const panelPartSchema = z.object({
  label: z.string().max(200).trim().default("Part"),
  lengthIn: positiveNumber.max(500),
  widthIn: positiveNumber.max(500),
  qty: z.number().int().min(1).max(999),
  materialCode: z.string().max(50).trim().optional().nullable(),
  thicknessIn: z.number().min(0).max(10).optional().nullable(),
  cutlistId: z.string().cuid().optional().nullable(),
});

export const panelPartUpdateSchema = panelPartSchema.partial();

const PREREQUISITE_CATEGORIES = ["finishing", "drawer_boxes", "hinges", "other"] as const;

export const cutlistSchema = z.object({
  projectItemId: z.string().cuid(),
  name: z.string().min(1, "Name is required").max(100).trim(),
});

export const prerequisiteLineSchema = z.object({
  materialCode: z.string().min(1, "Material code is required").max(50).trim(),
  category: z.enum(PREREQUISITE_CATEGORIES),
  quantity: z.number().min(0),
  needed: z.boolean().optional().default(true),
});

export const prerequisiteLineUpdateSchema = z.object({
  materialCode: z.string().min(1).max(50).trim().optional(),
  category: z.enum(PREREQUISITE_CATEGORIES).optional(),
  quantity: z.number().min(0).optional(),
  needed: z.boolean().optional(),
});

export const parseCutlistSchema = z.object({
  text: z.string().optional(),
});

const dateTransform = z
  .string()
  .optional()
  .nullable()
  .transform((s) => (s && s.trim() ? new Date(s) : null));

export const serviceCallSchema = z.object({
  clientName: z.string().max(200).trim().optional().nullable(),
  jobNumber: z.string().max(100).trim().optional().nullable(),
  address: z.string().max(500).trim().optional().nullable(),
  contactPerson: z.string().max(200).trim().optional().nullable(),
  clientPhone: z.string().max(50).trim().optional().nullable(),
  clientEmail: z.string().max(200).trim().optional().nullable(),
  serviceDate: dateTransform,
  timeOfArrival: dateTransform,
  timeOfDeparture: dateTransform,
  technicianName: z.string().max(200).trim().optional().nullable(),
  serviceCallNumber: z.string().max(100).trim().optional().nullable(),
  serviceCallType: z.string().max(200).optional().nullable(),
  reasonForService: z.string().max(5000).optional().nullable(),
  workPerformed: z.string().max(2000).trim().optional().nullable(),
  checklistJson: z.string().max(2000).optional().nullable(),
  materialsDescription: z.string().max(500).trim().optional().nullable(),
  materialsQuantity: z.string().max(100).trim().optional().nullable(),
  materialsProvidedBy: z.enum(["company", "client"]).optional().nullable(),
  serviceCompleted: z.boolean().optional().nullable(),
  additionalVisitRequired: z.boolean().optional().nullable(),
  additionalVisitReason: z.string().max(1000).trim().optional().nullable(),
  estimatedFollowUpDate: dateTransform,
  satisfactionJson: z.string().max(500).optional().nullable(),
  clientAcknowledgmentType: z.enum(["completed", "partial"]).optional().nullable(),
  followUpReason: z.string().max(1000).trim().optional().nullable(),
  clientSignature: z.string().max(500_000).optional().nullable(),
  responsibleSignature: z.string().max(500_000).optional().nullable(),
  notes: z.string().max(5000).trim().optional().nullable(),
});

export const serviceCallItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500).trim(),
  quantity: z.string().max(100).trim().optional().nullable(),
  providedBy: z.enum(["company", "client"]).optional().nullable(),
});

export const createServiceCallSchema = serviceCallSchema.extend({
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500).trim(),
        quantity: z.string().max(100).trim().optional().nullable(),
        providedBy: z.enum(["company", "client"]).optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export const distributorSchema = z.object({
  referenceName: z.string().min(1, "Reference name is required").max(200).trim(),
  companyName: z.string().min(1, "Company name is required").max(200).trim(),
  phoneNumber: z.string().max(50).trim().optional().nullable(),
  extension: z.string().max(20).trim().optional().nullable(),
  accountNumber: z.string().max(100).trim().optional().nullable(),
  notes: z.string().max(500).trim().optional().nullable(),
});

export const distributorUpdateSchema = distributorSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type VanityInputsValidated = z.infer<typeof vanityInputsSchema>;
export type SideUnitInputsValidated = z.infer<typeof sideUnitInputsSchema>;
export type KitchenBuilderPayloadValidated = z.infer<typeof kitchenBuilderPayloadSchema>;
export type KitchenBuilderApprovalValidated = z.infer<typeof kitchenBuilderApprovalSchema>;
export type ProjectSettingsValidated = z.infer<typeof projectSettingsSchema>;
export type CostLineValidated = z.infer<typeof costLineSchema>;
