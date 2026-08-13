-- Привязка нескольких профилей одного артиста к «главному» (AKA).
-- Nullable-колонка + индекс: аддитивно, существующие строки не трогает.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mainArtistId" TEXT;

CREATE INDEX IF NOT EXISTS "User_mainArtistId_idx" ON "User"("mainArtistId");
