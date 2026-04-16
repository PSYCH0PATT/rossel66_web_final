-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN "coverFetchedAt" TIMESTAMP(3),
ADD COLUMN "coverUrl" TEXT;

-- CreateIndex
CREATE INDEX "Playlist_coverFetchedAt_idx" ON "Playlist"("coverFetchedAt");
