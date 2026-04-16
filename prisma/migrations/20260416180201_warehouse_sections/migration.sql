-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "locationNote" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "WarehouseSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseSection_name_key" ON "WarehouseSection"("name");

-- CreateIndex
CREATE INDEX "WarehouseSection_sortOrder_name_idx" ON "WarehouseSection"("sortOrder", "name");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WarehouseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
