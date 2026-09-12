-- Filigrane personnalisé : clé R2 du logo téléversé par le client.
-- Réservé au plan Agence (planId = 'business'), appliqué à la place du
-- badge Pictaura par le pipeline de traitement.
ALTER TABLE "User" ADD COLUMN "brandLogoKey" TEXT;
