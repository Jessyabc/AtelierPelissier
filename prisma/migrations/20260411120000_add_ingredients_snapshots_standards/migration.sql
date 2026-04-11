-- AlterTable: VanityInputs — add height and sections for section-based configurator
ALTER TABLE "VanityInputs" ADD COLUMN "height" DOUBLE PRECISION;
ALTER TABLE "VanityInputs" ADD COLUMN "sections" TEXT;

-- AlterTable: SideUnitInputs — add sections for section-based configurator
ALTER TABLE "SideUnitInputs" ADD COLUMN "sections" TEXT;

-- CreateTable: ConstructionStandards (singleton — admin-editable construction defaults)
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

-- CreateTable: MaterialSnapshot (persisted material truth for a project)
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

-- CreateIndex
CREATE INDEX "MaterialSnapshot_projectId_sourceType_isActive_idx" ON "MaterialSnapshot"("projectId", "sourceType", "isActive");
CREATE INDEX "MaterialSnapshot_projectId_isStale_idx" ON "MaterialSnapshot"("projectId", "isStale");

-- AddForeignKey
ALTER TABLE "MaterialSnapshot" ADD CONSTRAINT "MaterialSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
