-- CreateTable
CREATE TABLE "ParserCookie" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParserCookie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParserRunStatus" (
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastRun" TIMESTAMP(3),
    "needsNewCookies" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParserRunStatus_pkey" PRIMARY KEY ("platform")
);

-- CreateIndex
CREATE INDEX "ParserCookie_platform_idx" ON "ParserCookie"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "ParserCookie_platform_name_key" ON "ParserCookie"("platform", "name");
