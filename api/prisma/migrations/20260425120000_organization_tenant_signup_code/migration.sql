-- Alphanumeric tenant self-signup code (landlord shares with renters; internal cuid still works).
ALTER TABLE "Organization" ADD COLUMN "tenantSignUpCode" TEXT;

CREATE UNIQUE INDEX "Organization_tenantSignUpCode_key" ON "Organization"("tenantSignUpCode");
