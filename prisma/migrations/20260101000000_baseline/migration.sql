-- Full schema baseline (generated with: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma).
-- If your database was created with `db push` and already has this schema, mark migrations applied instead of running raw SQL:
--   npx prisma migrate resolve --applied 20260101000000_baseline
--   npx prisma migrate resolve --applied 20260401140000_add_project_blocked_reason
--   npx prisma migrate resolve --applied 20260410120000_add_estimated_minutes_process_steps
--   npx prisma migrate resolve --applied 20260411120000_add_ingredients_snapshots_standards

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "types" TEXT NOT NULL DEFAULT 'vanity',
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentProjectId" TEXT,
    "jobNumber" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "client2Id" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientPhone2" TEXT,
    "clientAddress" TEXT,
    "sellingPrice" DOUBLE PRECISION,
    "targetDate" TIMESTAMP(3),
    "productionDelayWeeks" INTEGER NOT NULL DEFAULT 10,
    "blockedReason" TEXT,
    "processTemplateId" TEXT,
    "salespersonId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "processTemplateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectItemTaskItem" (
    "id" TEXT NOT NULL,
    "projectItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectItemTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTaskItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanityInputs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION,
    "kickplate" BOOLEAN NOT NULL,
    "framingStyle" TEXT NOT NULL,
    "mountingStyle" TEXT NOT NULL,
    "drawers" INTEGER NOT NULL,
    "doors" INTEGER NOT NULL,
    "thickFrame" BOOLEAN NOT NULL,
    "numberOfSinks" TEXT NOT NULL,
    "doorStyle" TEXT NOT NULL,
    "countertop" BOOLEAN NOT NULL,
    "countertopWidth" DOUBLE PRECISION,
    "countertopDepth" DOUBLE PRECISION,
    "sinks" TEXT,
    "faucetHoles" TEXT,
    "priceRangePi2" DOUBLE PRECISION,
    "sections" TEXT,

    CONSTRAINT "VanityInputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SideUnitInputs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "kickplate" BOOLEAN NOT NULL,
    "framingStyle" TEXT NOT NULL,
    "mountingStyle" TEXT NOT NULL,
    "drawers" INTEGER NOT NULL,
    "doors" INTEGER NOT NULL,
    "thickFrame" BOOLEAN NOT NULL,
    "doorStyle" TEXT NOT NULL,
    "sections" TEXT,

    CONSTRAINT "SideUnitInputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenInputs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "KitchenInputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.14975,
    "sheetFormatId" TEXT,
    "targetMarginOverride" DOUBLE PRECISION,
    "warningMarginOverride" DOUBLE PRECISION,
    "highRiskMarginOverride" DOUBLE PRECISION,
    "criticalMarginOverride" DOUBLE PRECISION,
    "wasteFactorOverride" DOUBLE PRECISION,
    "inventoryShortageHighOverride" DOUBLE PRECISION,

    CONSTRAINT "ProjectSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "label" TEXT NOT NULL,
    "lengthIn" DOUBLE PRECISION NOT NULL,
    "widthIn" DOUBLE PRECISION NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SheetFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cutlist" (
    "id" TEXT NOT NULL,
    "projectItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cutlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelPart" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cutlistId" TEXT,
    "label" TEXT NOT NULL,
    "lengthIn" DOUBLE PRECISION NOT NULL,
    "widthIn" DOUBLE PRECISION NOT NULL,
    "qty" INTEGER NOT NULL,
    "materialCode" TEXT,
    "thicknessIn" DOUBLE PRECISION,

    CONSTRAINT "PanelPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrerequisiteLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "needed" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrerequisiteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vendorInvoiceLineId" TEXT,

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCall" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientName" TEXT,
    "jobNumber" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "serviceDate" TIMESTAMP(3),
    "timeOfArrival" TIMESTAMP(3),
    "timeOfDeparture" TIMESTAMP(3),
    "technicianName" TEXT,
    "serviceCallNumber" TEXT,
    "serviceCallType" TEXT,
    "reasonForService" TEXT,
    "workPerformed" TEXT,
    "checklistJson" TEXT,
    "materialsDescription" TEXT,
    "materialsQuantity" TEXT,
    "materialsProvidedBy" TEXT,
    "serviceCompleted" BOOLEAN,
    "additionalVisitRequired" BOOLEAN,
    "additionalVisitReason" TEXT,
    "estimatedFollowUpDate" TIMESTAMP(3),
    "satisfactionJson" TEXT,
    "clientAcknowledgmentType" TEXT,
    "followUpReason" TEXT,
    "clientSignature" TEXT,
    "responsibleSignature" TEXT,
    "notes" TEXT,

    CONSTRAINT "ServiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCallItem" (
    "id" TEXT NOT NULL,
    "serviceCallId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" TEXT,
    "providedBy" TEXT,

    CONSTRAINT "ServiceCallItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCallItemFile" (
    "id" TEXT NOT NULL,
    "serviceCallItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,

    CONSTRAINT "ServiceCallItemFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlanItem" (
    "id" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "serviceCallId" TEXT,
    "title" TEXT,
    "scheduledTime" TEXT,
    "address" TEXT,
    "notes" TEXT,

    CONSTRAINT "DayPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "extension" TEXT,
    "accountNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'sheets',
    "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costDefault" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'sheetGoods',
    "defaultSheetFormatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "projectId" TEXT,
    "orderLineId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "requiredQty" DOUBLE PRECISION NOT NULL,
    "allocatedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "contactInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCatalogItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "leadTimeDays" INTEGER,
    "sheetFormatOverrideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'order',
    "expectedDeliveryDate" TIMESTAMP(3),
    "projectId" TEXT,
    "placedAt" TIMESTAMP(3),
    "leadTimeDays" INTEGER,
    "backorderExpectedDate" TIMESTAMP(3),
    "backorderNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "materialCode" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "projectItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingDeviation" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "expectedQty" DOUBLE PRECISION NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivingDeviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "groupKey" TEXT,
    "message" TEXT NOT NULL,
    "impactValue" DOUBLE PRECISION,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalRiskSettings" (
    "id" TEXT NOT NULL,
    "targetMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "warningMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "highRiskMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "criticalMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "wasteFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "inventoryShortageHigh" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalRiskSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTypeRiskOverride" (
    "id" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "targetMargin" DOUBLE PRECISION,
    "warningMargin" DOUBLE PRECISION,
    "highRiskMargin" DOUBLE PRECISION,
    "criticalMargin" DOUBLE PRECISION,
    "wasteFactor" DOUBLE PRECISION,
    "inventoryShortageHigh" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTypeRiskOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSettings" (
    "id" TEXT NOT NULL,
    "defaultMarkup" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "targetMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "warningMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "highRiskMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "criticalMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "wasteFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "inventoryShortageHigh" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "taxEnabledDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.14975,
    "defaultSheetFormatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "descriptionRaw" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "mappedInventoryItemId" TEXT,
    "mappedProjectId" TEXT,
    "mappedCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "parsedJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProcessStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepId" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedEmployeeId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStepEdge" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sourceStepId" TEXT NOT NULL,
    "targetStepId" TEXT NOT NULL,
    "conditionLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessStepEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Atelier Pelissier',
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyAddress" TEXT,
    "logoUrl" TEXT,
    "defaultEmployeeRate" DOUBLE PRECISION,
    "menuConfig" TEXT,
    "customRoomTypes" TEXT,
    "processDefaults" TEXT,
    "materialAliases" TEXT,
    "emailTemplates" TEXT,
    "integrations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppErrorLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "context" TEXT,
    "aiDiagnosticPrompt" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'woodworker',
    "employeeId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "hourlyRate" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimePunch" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "stationId" TEXT,
    "projectId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionStandards" (
    "id" TEXT NOT NULL,
    "standardBaseDepth" DOUBLE PRECISION NOT NULL DEFAULT 23.5,
    "defaultVanityHeight" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "wallHungHeight" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "kickplateHeight" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "panelThickness" DOUBLE PRECISION NOT NULL DEFAULT 0.625,
    "backThickness" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "stretcherDepth" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "framingWidth" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "drawerBoxHeight" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "drawerFrontHeight" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "doorGap" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "shelfSetback" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "thickFrameThickness" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "minSectionWidth" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "minSectionHeight" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionStandards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedByUserId" TEXT,
    "panelCount" INTEGER NOT NULL,
    "hardwareCount" INTEGER NOT NULL,
    "sheetCount" DOUBLE PRECISION NOT NULL,
    "frontCount" INTEGER NOT NULL DEFAULT 0,
    "drawerCount" INTEGER NOT NULL DEFAULT 0,
    "hingeCount" INTEGER NOT NULL DEFAULT 0,
    "dividerCount" INTEGER NOT NULL DEFAULT 0,
    "complexityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "functionCall" TEXT,
    "actionStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_isDone_isDraft_idx" ON "Project"("isDone", "isDraft");

-- CreateIndex
CREATE INDEX "Project_jobNumber_idx" ON "Project"("jobNumber");

-- CreateIndex
CREATE INDEX "Project_clientFirstName_clientLastName_idx" ON "Project"("clientFirstName", "clientLastName");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_targetDate_idx" ON "Project"("targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "VanityInputs_projectId_key" ON "VanityInputs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SideUnitInputs_projectId_key" ON "SideUnitInputs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenInputs_projectId_key" ON "KitchenInputs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");

-- CreateIndex
CREATE INDEX "PanelPart_cutlistId_idx" ON "PanelPart"("cutlistId");

-- CreateIndex
CREATE INDEX "PrerequisiteLine_projectId_category_idx" ON "PrerequisiteLine"("projectId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_materialCode_key" ON "InventoryItem"("materialCode");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_idx" ON "StockMovement"("inventoryItemId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "MaterialRequirement_materialCode_idx" ON "MaterialRequirement"("materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequirement_projectId_materialCode_key" ON "MaterialRequirement"("projectId", "materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_supplierSku_key" ON "SupplierCatalogItem"("supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_projectId_idx" ON "Order"("projectId");

-- CreateIndex
CREATE INDEX "Order_supplierId_idx" ON "Order"("supplierId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "CostDocument_projectId_type_idx" ON "CostDocument"("projectId", "type");

-- CreateIndex
CREATE INDEX "CostDocument_invoiceNumber_idx" ON "CostDocument"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ProjectProcessStep_projectId_sortOrder_idx" ON "ProjectProcessStep"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectProcessStep_assignedEmployeeId_scheduledDate_idx" ON "ProjectProcessStep"("assignedEmployeeId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ProjectProcessStep_scheduledDate_idx" ON "ProjectProcessStep"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStation_slug_key" ON "WorkStation"("slug");

-- CreateIndex
CREATE INDEX "TimePunch_employeeId_startTime_idx" ON "TimePunch"("employeeId", "startTime");

-- CreateIndex
CREATE INDEX "TimePunch_projectId_idx" ON "TimePunch"("projectId");

-- CreateIndex
CREATE INDEX "TimePunch_stationId_idx" ON "TimePunch"("stationId");

-- CreateIndex
CREATE INDEX "MaterialSnapshot_projectId_sourceType_isActive_idx" ON "MaterialSnapshot"("projectId", "sourceType", "isActive");

-- CreateIndex
CREATE INDEX "MaterialSnapshot_projectId_isStale_idx" ON "MaterialSnapshot"("projectId", "isStale");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_client2Id_fkey" FOREIGN KEY ("client2Id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_processTemplateId_fkey" FOREIGN KEY ("processTemplateId") REFERENCES "ProcessTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_processTemplateId_fkey" FOREIGN KEY ("processTemplateId") REFERENCES "ProcessTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItemTaskItem" ADD CONSTRAINT "ProjectItemTaskItem_projectItemId_fkey" FOREIGN KEY ("projectItemId") REFERENCES "ProjectItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskItem" ADD CONSTRAINT "ProjectTaskItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanityInputs" ADD CONSTRAINT "VanityInputs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideUnitInputs" ADD CONSTRAINT "SideUnitInputs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenInputs" ADD CONSTRAINT "KitchenInputs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_sheetFormatId_fkey" FOREIGN KEY ("sheetFormatId") REFERENCES "SheetFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cutlist" ADD CONSTRAINT "Cutlist_projectItemId_fkey" FOREIGN KEY ("projectItemId") REFERENCES "ProjectItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelPart" ADD CONSTRAINT "PanelPart_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelPart" ADD CONSTRAINT "PanelPart_cutlistId_fkey" FOREIGN KEY ("cutlistId") REFERENCES "Cutlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrerequisiteLine" ADD CONSTRAINT "PrerequisiteLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_vendorInvoiceLineId_fkey" FOREIGN KEY ("vendorInvoiceLineId") REFERENCES "VendorInvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCall" ADD CONSTRAINT "ServiceCall_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCallItem" ADD CONSTRAINT "ServiceCallItem_serviceCallId_fkey" FOREIGN KEY ("serviceCallId") REFERENCES "ServiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCallItemFile" ADD CONSTRAINT "ServiceCallItemFile_serviceCallItemId_fkey" FOREIGN KEY ("serviceCallItemId") REFERENCES "ServiceCallItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanItem" ADD CONSTRAINT "DayPlanItem_serviceCallId_fkey" FOREIGN KEY ("serviceCallId") REFERENCES "ServiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_defaultSheetFormatId_fkey" FOREIGN KEY ("defaultSheetFormatId") REFERENCES "SheetFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequirement" ADD CONSTRAINT "MaterialRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_sheetFormatOverrideId_fkey" FOREIGN KEY ("sheetFormatOverrideId") REFERENCES "SheetFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_projectItemId_fkey" FOREIGN KEY ("projectItemId") REFERENCES "ProjectItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDeviation" ADD CONSTRAINT "ReceivingDeviation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deviation" ADD CONSTRAINT "Deviation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSettings" ADD CONSTRAINT "GlobalSettings_defaultSheetFormatId_fkey" FOREIGN KEY ("defaultSheetFormatId") REFERENCES "SheetFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceLine" ADD CONSTRAINT "VendorInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "VendorInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostDocument" ADD CONSTRAINT "CostDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProcessTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProcessStep" ADD CONSTRAINT "ProjectProcessStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProcessStep" ADD CONSTRAINT "ProjectProcessStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ProcessStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProcessStep" ADD CONSTRAINT "ProjectProcessStep_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStepEdge" ADD CONSTRAINT "ProcessStepEdge_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProcessTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStepEdge" ADD CONSTRAINT "ProcessStepEdge_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "ProcessStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStepEdge" ADD CONSTRAINT "ProcessStepEdge_targetStepId_fkey" FOREIGN KEY ("targetStepId") REFERENCES "ProcessStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimePunch" ADD CONSTRAINT "TimePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimePunch" ADD CONSTRAINT "TimePunch_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "WorkStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimePunch" ADD CONSTRAINT "TimePunch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSnapshot" ADD CONSTRAINT "MaterialSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

