-- Buildin dual-write foundation: form submissions, external IDs, outbox, playlist history

CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactTelegram" TEXT,
    "artistNickname" TEXT,
    "payload" JSONB NOT NULL,
    "filesMeta" JSONB NOT NULL DEFAULT '[]',
    "pyrusTaskId" TEXT,
    "buildinPageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormSubmission_idempotencyKey_key" ON "FormSubmission"("idempotencyKey");
CREATE INDEX "FormSubmission_formType_createdAt_idx" ON "FormSubmission"("formType", "createdAt");
CREATE INDEX "FormSubmission_status_createdAt_idx" ON "FormSubmission"("status", "createdAt");
CREATE INDEX "FormSubmission_pyrusTaskId_idx" ON "FormSubmission"("pyrusTaskId");
CREATE INDEX "FormSubmission_buildinPageId_idx" ON "FormSubmission"("buildinPageId");

CREATE TABLE "BuildinExternalId" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "buildinPageId" TEXT NOT NULL,
    "buildinDbKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT,

    CONSTRAINT "BuildinExternalId_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuildinExternalId_entityType_localId_key" ON "BuildinExternalId"("entityType", "localId");
CREATE UNIQUE INDEX "BuildinExternalId_buildinPageId_key" ON "BuildinExternalId"("buildinPageId");
CREATE INDEX "BuildinExternalId_entityType_buildinPageId_idx" ON "BuildinExternalId"("entityType", "buildinPageId");
CREATE INDEX "BuildinExternalId_submissionId_idx" ON "BuildinExternalId"("submissionId");

CREATE TABLE "BuildinOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BuildinOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuildinOutbox_status_nextAttemptAt_idx" ON "BuildinOutbox"("status", "nextAttemptAt");
CREATE INDEX "BuildinOutbox_eventType_status_idx" ON "BuildinOutbox"("eventType", "status");
CREATE INDEX "BuildinOutbox_submissionId_idx" ON "BuildinOutbox"("submissionId");

CREATE TABLE "PlaylistHistory" (
    "id" TEXT NOT NULL,
    "playlistUrl" TEXT NOT NULL,
    "playlistName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeDate" TEXT NOT NULL,
    "artistName" TEXT,
    "artistId" TEXT,
    "trackTitle" TEXT,
    "oldPosition" INTEGER,
    "newPosition" INTEGER,
    "metadata" JSONB,
    "buildinPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlaylistHistory_changeDate_idx" ON "PlaylistHistory"("changeDate");
CREATE INDEX "PlaylistHistory_artistId_idx" ON "PlaylistHistory"("artistId");
CREATE INDEX "PlaylistHistory_playlistUrl_idx" ON "PlaylistHistory"("playlistUrl");
CREATE INDEX "PlaylistHistory_changeType_idx" ON "PlaylistHistory"("changeType");
CREATE INDEX "PlaylistHistory_createdAt_idx" ON "PlaylistHistory"("createdAt");

ALTER TABLE "BuildinExternalId" ADD CONSTRAINT "BuildinExternalId_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuildinOutbox" ADD CONSTRAINT "BuildinOutbox_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
