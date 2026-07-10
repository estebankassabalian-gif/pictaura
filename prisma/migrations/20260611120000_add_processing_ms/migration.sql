-- AlterTable : telemetrie de duree de traitement par photo (download + Gemini + crop + upload)
ALTER TABLE "processed_photos" ADD COLUMN "processingMs" INTEGER;
