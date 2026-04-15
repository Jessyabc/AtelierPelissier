-- Kitchen pricing builder normalized persistence

CREATE TABLE "KitchenPricingProject" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "includeInstallation" BOOLEAN NOT NULL DEFAULT false,
  "includeDelivery" BOOLEAN NOT NULL DEFAULT true,
  "deliveryCost" DOUBLE PRECISION,
  "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountReason" TEXT,
  "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
  "approvalReason" TEXT,
  "approvedByRole" TEXT,
  "submittedByRole" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPricingCabinet" (
  "id" TEXT NOT NULL,
  "kitchenPricingProjectId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "cabinetType" TEXT NOT NULL,
  "configuration" TEXT NOT NULL,
  "cabinetBoxMaterialId" TEXT NOT NULL,
  "cabinetBoxQuantity" INTEGER NOT NULL DEFAULT 1,
  "manualFabricationHours" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingCabinet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPricingDoorSpec" (
  "id" TEXT NOT NULL,
  "kitchenPricingCabinetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "widthInches" DOUBLE PRECISION NOT NULL,
  "heightInches" DOUBLE PRECISION NOT NULL,
  "quantity" INTEGER NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingDoorSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPricingDrawerSpec" (
  "id" TEXT NOT NULL,
  "kitchenPricingCabinetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "drawerSystemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingDrawerSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPricingHardware" (
  "id" TEXT NOT NULL,
  "kitchenPricingCabinetId" TEXT NOT NULL,
  "standardHinges" INTEGER NOT NULL DEFAULT 0,
  "verticalHinges" INTEGER NOT NULL DEFAULT 0,
  "handleTypeId" TEXT NOT NULL DEFAULT 'standard_handle',
  "handleQuantity" INTEGER NOT NULL DEFAULT 0,
  "pattes" INTEGER NOT NULL DEFAULT 0,
  "ledQuantity" INTEGER NOT NULL DEFAULT 0,
  "wasteBinQuantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingHardware_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPricingInstallationItem" (
  "id" TEXT NOT NULL,
  "kitchenPricingProjectId" TEXT NOT NULL,
  "installTypeId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KitchenPricingInstallationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenPricingProject_projectId_key" ON "KitchenPricingProject"("projectId");
CREATE INDEX "KitchenPricingCabinet_kitchenPricingProjectId_sortOrder_idx"
  ON "KitchenPricingCabinet"("kitchenPricingProjectId", "sortOrder");
CREATE INDEX "KitchenPricingDoorSpec_kitchenPricingCabinetId_sortOrder_idx"
  ON "KitchenPricingDoorSpec"("kitchenPricingCabinetId", "sortOrder");
CREATE INDEX "KitchenPricingDrawerSpec_kitchenPricingCabinetId_sortOrder_idx"
  ON "KitchenPricingDrawerSpec"("kitchenPricingCabinetId", "sortOrder");
CREATE UNIQUE INDEX "KitchenPricingHardware_kitchenPricingCabinetId_key"
  ON "KitchenPricingHardware"("kitchenPricingCabinetId");
CREATE INDEX "KitchenPricingInstallationItem_kitchenPricingProjectId_installTypeId_idx"
  ON "KitchenPricingInstallationItem"("kitchenPricingProjectId", "installTypeId");

ALTER TABLE "KitchenPricingProject"
  ADD CONSTRAINT "KitchenPricingProject_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenPricingCabinet"
  ADD CONSTRAINT "KitchenPricingCabinet_kitchenPricingProjectId_fkey"
  FOREIGN KEY ("kitchenPricingProjectId") REFERENCES "KitchenPricingProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenPricingDoorSpec"
  ADD CONSTRAINT "KitchenPricingDoorSpec_kitchenPricingCabinetId_fkey"
  FOREIGN KEY ("kitchenPricingCabinetId") REFERENCES "KitchenPricingCabinet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenPricingDrawerSpec"
  ADD CONSTRAINT "KitchenPricingDrawerSpec_kitchenPricingCabinetId_fkey"
  FOREIGN KEY ("kitchenPricingCabinetId") REFERENCES "KitchenPricingCabinet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenPricingHardware"
  ADD CONSTRAINT "KitchenPricingHardware_kitchenPricingCabinetId_fkey"
  FOREIGN KEY ("kitchenPricingCabinetId") REFERENCES "KitchenPricingCabinet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenPricingInstallationItem"
  ADD CONSTRAINT "KitchenPricingInstallationItem_kitchenPricingProjectId_fkey"
  FOREIGN KEY ("kitchenPricingProjectId") REFERENCES "KitchenPricingProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
