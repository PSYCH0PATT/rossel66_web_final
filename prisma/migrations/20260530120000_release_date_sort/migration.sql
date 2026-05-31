-- AlterTable
ALTER TABLE "Release" ADD COLUMN "releaseDateSort" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Release_releaseDateSort_idx" ON "Release"("releaseDateSort");

-- CreateIndex
CREATE INDEX "Release_artistId_releaseDateSort_idx" ON "Release"("artistId", "releaseDateSort");
