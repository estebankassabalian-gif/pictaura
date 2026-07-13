-- AlterTable : ledger de remboursement par job — total deja rembourse, pour
-- garantir qu'un job ne peut jamais etre rembourse au-dela de ce qui lui est
-- du, meme si plusieurs chemins (pipeline crash, recovery jobs bloques,
-- action admin) tentent un remboursement concurrent sur le meme job.
ALTER TABLE "processing_jobs" ADD COLUMN "refundedCredits" INTEGER NOT NULL DEFAULT 0;
