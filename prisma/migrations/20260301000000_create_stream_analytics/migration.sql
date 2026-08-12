-- Baseline for a table that was created by hand in Supabase and never had a migration.
--
-- Three later migrations already depend on it — 20260319000000_add_compound_indexes,
-- 20260418130000_stream_analytics_unique_constraint and 20260609120000_enable_rls_server_only —
-- so `prisma migrate deploy` failed on any empty database, and entrypoint.sh runs it on every
-- container start.
--
-- Timestamped before those three so it applies first. Every statement is IF NOT EXISTS, so it
-- is a no-op on databases where the table already exists. On those, mark it applied instead:
--   pnpm exec prisma migrate resolve --applied 20260301000000_create_stream_analytics

-- CreateTable
CREATE TABLE IF NOT EXISTS "StreamAnalytics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dsp" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isrc" TEXT NOT NULL,
    "trackArtist" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "albumTitle" TEXT NOT NULL,
    "cpline" TEXT,
    "albumReleaseDate" TEXT,
    "daysSinceRelease" INTEGER,
    "streams" INTEGER NOT NULL,
    "artistId" TEXT,
    "isMonthlyAggregate" BOOLEAN NOT NULL DEFAULT false,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_date_idx" ON "StreamAnalytics"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_artistId_idx" ON "StreamAnalytics"("artistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_isrc_idx" ON "StreamAnalytics"("isrc");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_dsp_idx" ON "StreamAnalytics"("dsp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_isMonthlyAggregate_idx" ON "StreamAnalytics"("isMonthlyAggregate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StreamAnalytics_year_month_idx" ON "StreamAnalytics"("year", "month");

-- The compound indexes (artistId+date, artistId+isMonthlyAggregate+year+month) come from
-- 20260319000000_add_compound_indexes, and the unique key stream_analytics_flash_row_key from
-- 20260418130000_stream_analytics_unique_constraint. Both stay where they are.
