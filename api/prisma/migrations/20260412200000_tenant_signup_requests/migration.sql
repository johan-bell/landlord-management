-- Tenant self-signup pending admin approval (org id/slug + email)

CREATE TYPE "TenantSignupStatus" AS ENUM ('PENDING', 'REJECTED');

CREATE TABLE "TenantSignupRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TenantSignupStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSignupRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSignupRequest_userId_key" ON "TenantSignupRequest"("userId");

CREATE INDEX "TenantSignupRequest_organizationId_idx" ON "TenantSignupRequest"("organizationId");

CREATE INDEX "TenantSignupRequest_status_idx" ON "TenantSignupRequest"("status");

ALTER TABLE "TenantSignupRequest" ADD CONSTRAINT "TenantSignupRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantSignupRequest" ADD CONSTRAINT "TenantSignupRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
