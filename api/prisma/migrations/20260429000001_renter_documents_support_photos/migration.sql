-- Renter document storage (lease PDFs, IDs, signed agreements, etc.)
CREATE TABLE "RenterDocument" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "renterId"         TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "objectKey"        TEXT NOT NULL,
    "mimeType"         TEXT NOT NULL,
    "label"            TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "RenterDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RenterDocument_renterId_idx" ON "RenterDocument"("renterId");
CREATE INDEX "RenterDocument_organizationId_idx" ON "RenterDocument"("organizationId");
CREATE INDEX "RenterDocument_deletedAt_idx" ON "RenterDocument"("deletedAt");

ALTER TABLE "RenterDocument" ADD CONSTRAINT "RenterDocument_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RenterDocument" ADD CONSTRAINT "RenterDocument_renterId_fkey"
    FOREIGN KEY ("renterId") REFERENCES "Renter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RenterDocument" ADD CONSTRAINT "RenterDocument_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Support request photo attachment
ALTER TABLE "SupportRequest" ADD COLUMN "photoObjectKey" TEXT;
ALTER TABLE "SupportRequest" ADD COLUMN "photoMimeType"  TEXT;
