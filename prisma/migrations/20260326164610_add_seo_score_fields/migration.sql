-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'AWAITING_VALIDATION';
ALTER TYPE "JobStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "Preset" ADD VALUE 'IMMOBILIER';

-- AlterTable
ALTER TABLE "inpainting_jobs" ALTER COLUMN "creditsCost" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "processed_photos" ADD COLUMN     "seoHashtags" TEXT,
ADD COLUMN     "seoKeywords" TEXT,
ADD COLUMN     "seoMetaTitle" TEXT,
ADD COLUMN     "seoSchemaJson" TEXT;
