-- AlterTable
ALTER TABLE "ConstructionStandards" ADD COLUMN     "kitchenBaseDepth" DOUBLE PRECISION NOT NULL DEFAULT 23.375,
ADD COLUMN     "kitchenBaseHeight" DOUBLE PRECISION NOT NULL DEFAULT 34.75,
ADD COLUMN     "kitchenKickplateHeight" DOUBLE PRECISION NOT NULL DEFAULT 4.75,
ADD COLUMN     "kitchenTopSilenceHeight" DOUBLE PRECISION NOT NULL DEFAULT 3,
ADD COLUMN     "vanityDepthStandard" DOUBLE PRECISION NOT NULL DEFAULT 21.75,
ADD COLUMN     "vanityDepthWallMountedFaucet" DOUBLE PRECISION NOT NULL DEFAULT 19.75,
ADD COLUMN     "vanityFreestandingHeight" DOUBLE PRECISION NOT NULL DEFAULT 34;

-- CreateTable
CREATE TABLE "StandardsOverride" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "standardKey" TEXT NOT NULL,
    "standardValue" DOUBLE PRECISION NOT NULL,
    "overrideValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'in',
    "sectionId" TEXT,
    "riskTier" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardsOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandardsOverride_projectId_status_idx" ON "StandardsOverride"("projectId", "status");

-- CreateIndex
CREATE INDEX "StandardsOverride_status_riskTier_idx" ON "StandardsOverride"("status", "riskTier");

-- CreateIndex
CREATE INDEX "StandardsOverride_standardKey_idx" ON "StandardsOverride"("standardKey");

-- AddForeignKey
ALTER TABLE "StandardsOverride" ADD CONSTRAINT "StandardsOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
