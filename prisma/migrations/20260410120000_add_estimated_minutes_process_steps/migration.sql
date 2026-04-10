-- Align DB with prisma/schema.prisma: duration hints on process steps.
-- Safe if columns already exist (Postgres 11+).
ALTER TABLE "ProcessStep" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;
ALTER TABLE "ProjectProcessStep" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;
