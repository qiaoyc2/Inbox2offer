-- AlterTable
ALTER TABLE "RawEmail" ADD COLUMN "disposition" TEXT;
ALTER TABLE "RawEmail" ADD COLUMN "parseEvidence" JSONB;
ALTER TABLE "RawEmail" ADD COLUMN "parseSecondarySignals" JSONB;
ALTER TABLE "RawEmail" ADD COLUMN "parsedCompany" TEXT;
ALTER TABLE "RawEmail" ADD COLUMN "parsedPosition" TEXT;
ALTER TABLE "RawEmail" ADD COLUMN "parserType" TEXT;
ALTER TABLE "RawEmail" ADD COLUMN "parserVersion" TEXT;

-- CreateIndex
CREATE INDEX "RawEmail_disposition_idx" ON "RawEmail"("disposition");
