-- Distributed rate limit buckets for form APIs
CREATE TABLE IF NOT EXISTS "FormRateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRateBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "FormRateBucket_resetAt_idx" ON "FormRateBucket"("resetAt");
