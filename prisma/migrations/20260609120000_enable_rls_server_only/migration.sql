-- Server-only tables: block PostgREST (anon/authenticated) while Prisma (postgres role) keeps full access.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Release" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Playlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsArtistAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StreamAnalytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParserCookie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParserRunStatus" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "User" FROM anon, authenticated;
REVOKE ALL ON TABLE "Release" FROM anon, authenticated;
REVOKE ALL ON TABLE "Report" FROM anon, authenticated;
REVOKE ALL ON TABLE "Activity" FROM anon, authenticated;
REVOKE ALL ON TABLE "Playlist" FROM anon, authenticated;
REVOKE ALL ON TABLE "AnalyticsArtistAlias" FROM anon, authenticated;
REVOKE ALL ON TABLE "StreamAnalytics" FROM anon, authenticated;
REVOKE ALL ON TABLE "ParserCookie" FROM anon, authenticated;
REVOKE ALL ON TABLE "ParserRunStatus" FROM anon, authenticated;
