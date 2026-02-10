-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_userId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_artistId_fkey";

-- AlterTable
ALTER TABLE "Release" ALTER COLUMN "artistId" DROP NOT NULL;
