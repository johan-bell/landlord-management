-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('MAINTENANCE', 'BILLING', 'GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "category" "SupportCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "urgency" "SupportUrgency" NOT NULL DEFAULT 'NORMAL';
