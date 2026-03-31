-- DropForeignKey
ALTER TABLE "inpainting_jobs" DROP CONSTRAINT "inpainting_jobs_photoId_fkey";

-- AlterTable
ALTER TABLE "inpainting_jobs" ALTER COLUMN "photoId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inpainting_jobs_status_idx" ON "inpainting_jobs"("status");

-- AddForeignKey
ALTER TABLE "inpainting_jobs" ADD CONSTRAINT "inpainting_jobs_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "processed_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
