-- Add sales lifecycle stage to Project
ALTER TABLE "Project"
  ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'confirmed',
  ADD COLUMN "depositReceivedAt" TIMESTAMP(3);

CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- Follow-up thresholds for sales lifecycle on ConstructionStandards
ALTER TABLE "ConstructionStandards"
  ADD COLUMN "quoteFollowUpDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "invoiceFollowUpDays" INTEGER NOT NULL DEFAULT 7;
