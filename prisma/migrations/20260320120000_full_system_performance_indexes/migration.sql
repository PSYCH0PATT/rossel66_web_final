-- Partial indexes (registered reports, artist users)
CREATE INDEX IF NOT EXISTS "Report_registered_artist_quarter_year_idx"
  ON "Report" ("artistId", quarter, year)
  WHERE "isRegistered" = true;

CREATE INDEX IF NOT EXISTS "User_artists_username_name_idx"
  ON "User" (username, name)
  WHERE role = 'artist';

-- Covering indexes for balance and list queries
CREATE INDEX IF NOT EXISTS "Report_balance_covering_idx"
  ON "Report" ("artistId")
  INCLUDE ("totalAmount", "isPaid")
  WHERE "isRegistered" = true;

CREATE INDEX IF NOT EXISTS "Report_list_covering_idx"
  ON "Report" ("artistId", quarter)
  INCLUDE (year, "totalAmount", "uploadDate", status, "isPaid", "isSigned")
  WHERE "isRegistered" = true;

-- GIN for JSON tracks and array featuredArtistIds (Prisma Json = jsonb)
CREATE INDEX IF NOT EXISTS "Release_tracks_gin_idx"
  ON "Release" USING GIN (tracks);

CREATE INDEX IF NOT EXISTS "Release_featuredArtistIds_gin_idx"
  ON "Release" USING GIN ("featuredArtistIds");

-- Sort-heavy report lists
CREATE INDEX IF NOT EXISTS "Report_uploadedAt_desc_idx"
  ON "Report" ("uploadedAt" DESC);
