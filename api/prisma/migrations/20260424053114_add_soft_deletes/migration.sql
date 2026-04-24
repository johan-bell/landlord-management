-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Renter" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE INDEX "Renter_deletedAt_idx" ON "Renter"("deletedAt");

-- CreateIndex
CREATE INDEX "Unit_deletedAt_idx" ON "Unit"("deletedAt");
