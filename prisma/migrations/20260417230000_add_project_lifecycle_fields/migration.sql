-- Add sales-lifecycle fields to Project: archive + lost + last sales activity.
-- See prisma/schema.prisma::Project for the design rationale.

-- AlterTable
ALTER TABLE "Project"
  ADD COLUMN "archivedAt"          TIMESTAMP(3),
  ADD COLUMN "archiveReason"       TEXT,
  ADD COLUMN "lostReason"          TEXT,
  ADD COLUMN "lastSalesActivityAt" TIMESTAMP(3);

-- Backfill lastSalesActivityAt so the auto-archive sweep doesn't immediately
-- consume the whole dataset. For existing rows we treat "last touch of any
-- kind" as sales activity — a reasonable approximation until salespeople
-- start hitting the new intake/save endpoints that maintain this field.
UPDATE "Project" SET "lastSalesActivityAt" = "updatedAt";

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- CreateIndex
CREATE INDEX "Project_stage_lastSalesActivityAt_idx" ON "Project"("stage", "lastSalesActivityAt");
