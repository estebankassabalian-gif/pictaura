import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Pictaura",
  description: "Politique de confidentialité de Pictaura — comment vos données personnelles sont collectées et protégées.",
  robots: { index: false },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-brand-600 text-sm hover:underline mb-8 inline-block">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Politique de Confidentialité</h1>
        <p className="text-zinc-500 text-sm mb-10">Dernière mise à jour : mars 2025</p>

        <div className="prose prose-gray max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Responsable du traitement</h2>
            <p className="text-zinc-400">
              Esteban Kassabalian, éditeur de Pictaura (pictaura.app).
              Contact DPO : <a href="mailto:contact@pictaura.app" className="text-brand-600 hover:underline">contact@pictaura.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Données collectées</h2>
            <ul className="text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong>Données de compte :</strong> adresse email, nom (optionnel), mot de passe haché</li>
              <li><strong>Photos uploadées :</strong> stockées temporairement sur Cloudflare R2 (serveurs UE)</li>
              <li><strong>Données de paiement :</strong> gérées par Stripe — nous ne stockons aucune carte bancaire</li>
              <li><strong>Données de navigation :</strong> logs techniques (IP, user-agent) pour la sécurité</li>
              <li><strong>Historique des traitements :</strong> jobs, crédits utilisés, dates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Finalités du traitement</h2>
            <ul className="text-zinc-400 space-y-2 list-disc list-inside">
              <li>Fourniture du service de retouche photo</li>
              <li>Gestion des comptes et des paiements</li>
              <li>Envoi d'emails transactionnels (confirmation, résultats)</li>
              <li>Amélioration du service et détection des fraudes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Base légale</h2>
            <p className="text-zinc-400">
              Le traitement est fondé sur l'exécution du contrat (fourniture du service) et votre consentement
              pour les communications marketing. Les traitements de sécurité sont fondés sur notre intérêt légitime.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Durée de conservation</h2>
            <ul className="text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong>Photos :</strong> conservées jusqu'à suppression manuelle ou fermeture du compte</li>
              <li><strong>Données de compte :</strong> 3 ans après la dernière activité</li>
              <li><strong>Données de paiement :</strong> 10 ans (obligation légale comptable)</li>
              <li><strong>Logs de sécurité :</strong> 1 an</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Sous-traitants</h2>
            <ul className="text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong>Cloudflare R2</strong> — stockage des photos (USA, clauses contractuelles types)</li>
              <li><strong>Stripe</strong> — paiements (USA, certifié PCI-DSS)</li>
              <li><strong>Replicate</strong> — traitement IA des photos (USA)</li>
              <li><strong>Anthropic</strong> — génération de texte SEO (USA)</li>
              <li><strong>Resend</strong> — envoi d'emails transactionnels (USA)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Vos droits (RGPD)</h2>
            <p className="text-zinc-400">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="text-zinc-400 space-y-2 list-disc list-inside mt-2">
              <li><strong>Droit d'accès</strong> — obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> — corriger vos données</li>
              <li><strong>Droit à l'effacement</strong> — supprimer votre compte et données</li>
              <li><strong>Droit à la portabilité</strong> — exporter vos données</li>
              <li><strong>Droit d'opposition</strong> — vous opposer à certains traitements</li>
            </ul>
            <p className="text-zinc-400 mt-3">
              Pour exercer vos droits : <a href="mailto:contact@pictaura.app" className="text-brand-600 hover:underline">contact@pictaura.app</a>.
              Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener" className="text-brand-600 hover:underline">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Cookies</h2>
            <p className="text-zinc-400">
              Pictaura utilise uniquement des cookies strictement nécessaires au fonctionnement du service
              (session d'authentification). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Sécurité</h2>
            <p className="text-zinc-400">
              Les données sont transmises via HTTPS. Les mots de passe sont hachés avec bcrypt (coût 12).
              Les accès aux fichiers R2 sont protégés par des URLs signées à durée limitée (1 heure).
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
