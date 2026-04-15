-- Compound indexes for Report table
CREATE INDEX IF NOT EXISTS "Report_artistId_isRegistered_idx" ON "Report"("artistId", "isRegistered");
CREATE INDEX IF NOT EXISTS "Report_quarter_isRegistered_idx" ON "Report"("quarter", "isRegistered");
CREATE INDEX IF NOT EXISTS "Report_artistId_quarter_idx" ON "Report"("artistId", "quarter");

-- Compound index for Release table
CREATE INDEX IF NOT EXISTS "Release_artistId_createdAt_idx" ON "Release"("artistId", "createdAt");

-- Compound indexes for StreamAnalytics table
CREATE INDEX IF NOT EXISTS "StreamAnalytics_artistId_date_idx" ON "StreamAnalytics"("artistId", "date");
CREATE INDEX IF NOT EXISTS "StreamAnalytics_artistId_isMonthlyAggregate_year_month_idx" ON "StreamAnalytics"("artistId", "isMonthlyAggregate", "year", "month");

-- Compound index for Playlist table
CREATE INDEX IF NOT EXISTS "Playlist_artistId_platform_idx" ON "Playlist"("artistId", "platform");
