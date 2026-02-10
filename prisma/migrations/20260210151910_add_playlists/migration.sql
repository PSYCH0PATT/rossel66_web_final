-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "playlistUrl" TEXT NOT NULL,
    "playlistName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistId" TEXT,
    "trackData" JSONB NOT NULL DEFAULT '[]',
    "firstSeenDate" TEXT,
    "lastSeenDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Playlist_artistId_idx" ON "Playlist"("artistId");

-- CreateIndex
CREATE INDEX "Playlist_platform_idx" ON "Playlist"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_playlistUrl_playlistName_artistName_key" ON "Playlist"("playlistUrl", "playlistName", "artistName");
