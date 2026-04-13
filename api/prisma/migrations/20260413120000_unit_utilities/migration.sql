-- CreateEnum
CREATE TYPE "ElectricityBilling" AS ENUM ('PREPAID_EXTERNAL', 'METERED_KWH');

-- CreateEnum
CREATE TYPE "WaterBilling" AS ENUM ('NONE', 'METERED_M3');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "electricityBilling" "ElectricityBilling" NOT NULL DEFAULT 'PREPAID_EXTERNAL';

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "electricityPricePerKwh" DECIMAL(14,6);

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "waterBilling" "WaterBilling" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "waterPricePerM3" DECIMAL(12,2);
