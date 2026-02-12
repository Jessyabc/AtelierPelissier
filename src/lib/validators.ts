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

const projectTypeEnum = z.enum(["vanity", "side_unit", "kitchen"]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).trim(),
  types: z.array(projectTypeEnum).min(1, "Select at least one type").default(["vanity"]),
  jobNumber: z.string().max(100).trim().optional(),
  // Client info (optional on create; can be filled later)
  clientFirstName: z.string().max(100).trim().optional(),
  clientLastName: z.string().max(100).trim().optional(),
  clientEmail: z.string().max(200).trim().optional(),
  clientPhone: z.string().max(50).trim().optional(),
  clientAddress: z.string().max(500).trim().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  types: z.array(projectTypeEnum).optional(),
  isDraft: z.boolean().optional(),
  jobNumber: z.string().max(100).trim().optional().nullable(),
  notes: z.string().max(5000).trim().optional().nullable(),
  clientFirstName: z.string().max(100).trim().optional().nullable(),
  clientLastName: z.string().max(100).trim().optional().nullable(),
  clientEmail: z.string().max(200).trim().optional().nullable(),
  clientPhone: z.string().max(50).trim().optional().nullable(),
  clientAddress: z.string().max(500).trim().optional().nullable(),
});

export const vanityInputsSchema = z.object({
  width: widthInches.default(24),
  depth: depthInches.default(22),
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
});

export const panelPartUpdateSchema = panelPartSchema.partial();

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
export type ProjectSettingsValidated = z.infer<typeof projectSettingsSchema>;
export type CostLineValidated = z.infer<typeof costLineSchema>;
