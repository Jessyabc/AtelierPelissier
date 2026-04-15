-- AlterTable
ALTER TABLE "KitchenPricingCabinet" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KitchenPricingDoorSpec" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KitchenPricingDrawerSpec" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KitchenPricingHardware" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KitchenPricingInstallationItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KitchenPricingProject" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "KitchenPricingInstallationItem_kitchenPricingProjectId_installT" RENAME TO "KitchenPricingInstallationItem_kitchenPricingProjectId_inst_idx";
