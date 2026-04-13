-- Support tickets from tenants and landlord staff; platform admins handle them.

CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "fromTenant" BOOLEAN NOT NULL DEFAULT false,
    "submitterId" TEXT NOT NULL,
    "organizationId" TEXT,
    "handledById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_organizationId_idx" ON "SupportRequest"("organizationId");
CREATE INDEX "SupportRequest_submitterId_idx" ON "SupportRequest"("submitterId");
CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
