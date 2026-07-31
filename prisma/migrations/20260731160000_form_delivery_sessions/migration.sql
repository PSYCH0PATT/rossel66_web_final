-- Form delivery ledger for Buildin-only form intake (temporary, not business SoT)

CREATE TABLE IF NOT EXISTS "FormDeliverySession" (
    "id" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "title" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactTelegram" TEXT,
    "artistNickname" TEXT,
    "clientIp" TEXT,
    "buildinPageId" TEXT,
    "submissionId" TEXT,
    "totalReleases" INTEGER NOT NULL DEFAULT 0,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "completedFiles" INTEGER NOT NULL DEFAULT 0,
    "encryptedManifest" BYTEA,
    "manifestIv" BYTEA,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDeliverySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FormDeliverySession_idempotencyKey_key" ON "FormDeliverySession"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FormDeliverySession_status_expiresAt_idx" ON "FormDeliverySession"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "FormDeliverySession_clientIp_status_idx" ON "FormDeliverySession"("clientIp", "status");
CREATE INDEX IF NOT EXISTS "FormDeliverySession_buildinPageId_idx" ON "FormDeliverySession"("buildinPageId");
CREATE INDEX IF NOT EXISTS "FormDeliverySession_submissionId_idx" ON "FormDeliverySession"("submissionId");

CREATE TABLE IF NOT EXISTS "FormDeliveryItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "releaseIndex" INTEGER NOT NULL,
    "trackIndex" INTEGER,
    "localKey" TEXT NOT NULL,
    "buildinPageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FormDeliveryItem_sessionId_localKey_key" ON "FormDeliveryItem"("sessionId", "localKey");
CREATE INDEX IF NOT EXISTS "FormDeliveryItem_sessionId_kind_status_idx" ON "FormDeliveryItem"("sessionId", "kind", "status");
CREATE INDEX IF NOT EXISTS "FormDeliveryItem_buildinPageId_idx" ON "FormDeliveryItem"("buildinPageId");

CREATE TABLE IF NOT EXISTS "FormDeliveryFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "itemId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "parentPageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "buildinOssName" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDeliveryFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FormDeliveryFile_sessionId_fieldKey_key" ON "FormDeliveryFile"("sessionId", "fieldKey");
CREATE INDEX IF NOT EXISTS "FormDeliveryFile_sessionId_status_idx" ON "FormDeliveryFile"("sessionId", "status");
CREATE INDEX IF NOT EXISTS "FormDeliveryFile_itemId_idx" ON "FormDeliveryFile"("itemId");

DO $$ BEGIN
  ALTER TABLE "FormDeliverySession" ADD CONSTRAINT "FormDeliverySession_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FormDeliveryItem" ADD CONSTRAINT "FormDeliveryItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "FormDeliverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FormDeliveryFile" ADD CONSTRAINT "FormDeliveryFile_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "FormDeliverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FormDeliveryFile" ADD CONSTRAINT "FormDeliveryFile_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "FormDeliveryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
