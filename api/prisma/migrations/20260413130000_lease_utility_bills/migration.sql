-- CreateEnum
CREATE TYPE "UtilityKind" AS ENUM ('ELECTRICITY', 'WATER');

-- CreateTable
CREATE TABLE "LeaseUtilityBill" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "kind" "UtilityKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseUtilityBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseUtilityBill_leaseId_kind_year_month_key" ON "LeaseUtilityBill"("leaseId", "kind", "year", "month");

-- CreateIndex
CREATE INDEX "LeaseUtilityBill_leaseId_idx" ON "LeaseUtilityBill"("leaseId");

-- AddForeignKey
ALTER TABLE "LeaseUtilityBill" ADD CONSTRAINT "LeaseUtilityBill_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
