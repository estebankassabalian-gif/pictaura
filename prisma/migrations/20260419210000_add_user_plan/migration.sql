-- AlterTable : ajout des colonnes planId et billingInterval sur User
ALTER TABLE "users" ADD COLUMN "planId" TEXT;
ALTER TABLE "users" ADD COLUMN "billingInterval" TEXT;

-- Migration des abonnés existants : tous ceux qui étaient isSubscribed=true
-- basculent sur le plan "pro" mensuel (équivalent le plus proche de l'ancien 49,90€/500 crédits).
-- Leur abonnement Stripe en cours continue de tourner inchangé jusqu'à annulation.
UPDATE "users"
SET "planId" = 'pro', "billingInterval" = 'month'
WHERE "isSubscribed" = true;
