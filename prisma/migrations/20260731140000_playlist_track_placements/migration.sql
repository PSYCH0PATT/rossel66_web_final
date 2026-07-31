-- CreateTable
CREATE TABLE "PlaylistTrackPlacement" (
    "id" TEXT NOT NULL,
    "placementKey" TEXT NOT NULL,
    "playlistUrl" TEXT NOT NULL,
    "playlistName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistId" TEXT,
    "trackTitle" TEXT NOT NULL,
    "isrc" TEXT,
    "firstSeenDate" TEXT NOT NULL,
    "lastSeenDate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "playlistRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistTrackPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistTrackPlacement_placementKey_key" ON "PlaylistTrackPlacement"("placementKey");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_playlistUrl_idx" ON "PlaylistTrackPlacement"("playlistUrl");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_artistId_idx" ON "PlaylistTrackPlacement"("artistId");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_isActive_idx" ON "PlaylistTrackPlacement"("isActive");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_lastSeenDate_idx" ON "PlaylistTrackPlacement"("lastSeenDate");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_playlistRowId_idx" ON "PlaylistTrackPlacement"("playlistRowId");

-- CreateIndex
CREATE INDEX "PlaylistTrackPlacement_playlistUrl_artistName_idx" ON "PlaylistTrackPlacement"("playlistUrl", "artistName");
