-- CreateTable
CREATE TABLE "AnalyticsArtistAlias" (
    "id" TEXT NOT NULL,
    "trackArtist" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsArtistAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsArtistAlias_trackArtist_key" ON "AnalyticsArtistAlias"("trackArtist");

-- CreateIndex
CREATE INDEX "AnalyticsArtistAlias_artistId_idx" ON "AnalyticsArtistAlias"("artistId");
