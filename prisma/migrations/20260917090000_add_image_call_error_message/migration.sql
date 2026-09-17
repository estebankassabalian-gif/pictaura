-- AlterTable : message brut (assaini, tronque) des appels image en echec.
-- Le code d'erreur seul agrege des causes distinctes : l'incident du
-- 2026-09-16 (8 rejets "content_policy") ne permettait pas de savoir s'il
-- s'agissait d'un refus du filtre ou d'une generation ratee. Colonne
-- nullable, sans defaut : ajout instantane, aucune reecriture de table.
ALTER TABLE "image_call_events" ADD COLUMN "errorMessage" TEXT;
