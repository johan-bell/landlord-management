-- CreateEnum
CREATE TYPE "ProofVerificationStatus" AS ENUM ('NONE', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED');

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "proofObjectKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofMimeType" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofVerification" "ProofVerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Payment" ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "proofVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "proofVerifiedByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofRejectionNote" TEXT;

-- AlterTable LeaseUtilityBill
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "previousIndex" DECIMAL(18,6);
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "currentIndex" DECIMAL(18,6);
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "consumption" DECIMAL(18,6);
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofObjectKey" TEXT;
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofMimeType" TEXT;
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofVerification" "ProofVerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofVerifiedAt" TIMESTAMP(3);
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofVerifiedByUserId" TEXT;
ALTER TABLE "LeaseUtilityBill" ADD COLUMN "proofRejectionNote" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_proofVerifiedByUserId_fkey" FOREIGN KEY ("proofVerifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseUtilityBill" ADD CONSTRAINT "LeaseUtilityBill_proofVerifiedByUserId_fkey" FOREIGN KEY ("proofVerifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
