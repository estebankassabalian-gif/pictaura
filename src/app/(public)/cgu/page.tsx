import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Pictaura",
  description: "CGU de Pictaura — conditions d'utilisation du service de retouche photo par IA.",
  robots: { index: false },
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-brand-600 text-sm hover:underline mb-8 inline-block">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-zinc-500 text-sm mb-10">Dernière mise à jour : mars 2025</p>

        <div className="prose prose-gray max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Présentation du service</h2>
            <p className="text-zinc-400">
              Pictaura est un service en ligne de retouche et d'optimisation de photos par intelligence artificielle,
              édité par Esteban Kassabalian (ci-après « l'Éditeur »). Le service est accessible à l'adresse
              pictaura.app et permet aux utilisateurs de traiter leurs photos pour différentes plateformes
              (Airbnb, Instagram, Vinted, Shopify).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Acceptation des CGU</h2>
            <p className="text-zinc-400">
              L'utilisation du service implique l'acceptation pleine et entière des présentes CGU.
              Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Compte utilisateur</h2>
            <p className="text-zinc-400">
              Pour accéder au service, vous devez créer un compte avec une adresse email valide.
              Vous êtes responsable de la confidentialité de vos identifiants de connexion.
              Chaque compte est strictement personnel et ne peut pas être partagé.
            </p>
            <p className="text-zinc-400 mt-2">
              À l'inscription, 5 crédits gratuits sont offerts pour découvrir le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Crédits et paiements</h2>
            <p className="text-zinc-400">
              Le service fonctionne sur un système de crédits. 1 crédit = 1 photo traitée.
              Les crédits sont achetés par packs et ne sont pas remboursables sauf en cas de dysfonctionnement
              avéré du service. Les crédits n'ont pas de date d'expiration.
            </p>
            <p className="text-zinc-400 mt-2">
              Les paiements sont sécurisés via Stripe. L'Éditeur ne stocke aucune donnée bancaire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Photos et contenus</h2>
            <p className="text-zinc-400">
              Vous conservez l'intégralité des droits sur vos photos. L'Éditeur ne revendique aucun droit
              sur les contenus uploadés. Les photos sont stockées de manière temporaire sur des serveurs
              sécurisés (Cloudflare R2) et peuvent être supprimées à tout moment sur demande.
            </p>
            <p className="text-zinc-400 mt-2">
              Il est interdit d'uploader des photos illégales, portant atteinte aux droits de tiers,
              à caractère pornographique ou violent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Disponibilité du service</h2>
            <p className="text-zinc-400">
              L'Éditeur s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7, mais ne peut
              garantir une disponibilité sans interruption. Des maintenances peuvent être effectuées sans
              préavis. Aucun remboursement ne sera effectué en cas d'indisponibilité ponctuelle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Limitation de responsabilité</h2>
            <p className="text-zinc-400">
              Le service est fourni « en l'état ». L'Éditeur ne peut être tenu responsable des dommages
              indirects liés à l'utilisation du service. La responsabilité de l'Éditeur est limitée au
              montant des crédits achetés par l'utilisateur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Résiliation</h2>
            <p className="text-zinc-400">
              Vous pouvez supprimer votre compte à tout moment en contactant le support.
              L'Éditeur se réserve le droit de suspendre ou supprimer un compte en cas de violation des CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Droit applicable</h2>
            <p className="text-zinc-400">
              Les présentes CGU sont régies par le droit français. En cas de litige, les tribunaux
              français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p className="text-zinc-400">
              Pour toute question relative aux CGU : <a href="mailto:contact@pictaura.app" className="text-brand-600 hover:underline">contact@pictaura.app</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
