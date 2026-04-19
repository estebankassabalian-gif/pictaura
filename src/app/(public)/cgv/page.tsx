import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — Pictaura",
  description: "CGV de Pictaura — abonnements, paiements, droit de rétractation, remboursement.",
  robots: { index: false },
};

export default function CgvPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-accent text-sm font-semibold hover:underline mb-8 inline-block">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="text-4xl md:text-5xl font-display tracking-tight text-ink mb-3">Conditions Générales de Vente</h1>
        <p className="text-ink-muted text-sm mb-10">Dernière mise à jour : avril 2026</p>

        <div className="prose max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-display text-ink mb-3">1. Objet</h2>
            <p className="text-ink-muted">
              Les présentes Conditions Générales de Vente (« CGV ») régissent la vente, à distance, des
              abonnements et des packs de crédits proposés par Pictaura, service édité par Esteban
              Kassabalian (ci-après « l&apos;Éditeur »), à toute personne physique ou morale (ci-après
              « le Client ») souscrivant via le site pictaura.app.
            </p>
            <p className="text-ink-muted mt-2">
              Toute commande implique l&apos;acceptation sans réserve des présentes CGV, des{" "}
              <Link href="/cgu" className="text-accent font-semibold hover:underline">CGU</Link> et de la{" "}
              <Link href="/politique-confidentialite" className="text-accent font-semibold hover:underline">
                politique de confidentialité
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">2. Description du service</h2>
            <p className="text-ink-muted">
              Pictaura est un service en ligne (SaaS) de retouche et d&apos;optimisation de photos par
              intelligence artificielle, destiné aux plateformes Airbnb, Booking, Instagram, Vinted et
              Shopify. Le service fonctionne sur un système de crédits (1 crédit = 1 photo traitée).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">3. Offres commerciales</h2>
            <p className="text-ink-muted mb-3">
              L&apos;Éditeur propose quatre formules :
            </p>
            <ul className="text-ink-muted space-y-2 list-disc list-inside">
              <li><strong>Pack 30 crédits</strong> — paiement unique de 9,90€ TTC. Sans engagement. Crédits sans date d&apos;expiration.</li>
              <li><strong>Abonnement Starter</strong> — 14,90€ TTC/mois ou 143€ TTC/an (soit 11,92€/mois). 100 crédits renouvelés chaque mois.</li>
              <li><strong>Abonnement Pro</strong> — 39,90€ TTC/mois ou 383€ TTC/an (soit 31,92€/mois). 400 crédits renouvelés chaque mois.</li>
              <li><strong>Abonnement Business</strong> — 89,90€ TTC/mois ou 863€ TTC/an (soit 71,92€/mois). 1200 crédits renouvelés chaque mois.</li>
            </ul>
            <p className="text-ink-muted mt-3">
              Les crédits des abonnements ne sont pas cumulables d&apos;un mois sur l&apos;autre. Les crédits
              du pack one-shot n&apos;expirent pas.
            </p>
            <p className="text-ink-muted mt-2">
              Les prix affichés sont en euros, toutes taxes comprises (TTC). L&apos;Éditeur peut modifier
              ses tarifs à tout moment ; les nouveaux tarifs s&apos;appliquent uniquement aux nouvelles
              commandes et aux renouvellements à venir, avec un préavis de 30 jours par email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">4. Commande et paiement</h2>
            <p className="text-ink-muted">
              La commande est passée en ligne depuis la page /billing après connexion. Le paiement est
              effectué par carte bancaire via Stripe (prestataire de paiement sécurisé certifié PCI-DSS).
              L&apos;Éditeur ne stocke aucune donnée bancaire.
            </p>
            <p className="text-ink-muted mt-2">
              La commande est ferme et définitive dès validation du paiement par Stripe. Une confirmation
              est envoyée par email. Les crédits sont crédités automatiquement sur le compte du Client.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">5. Renouvellement et résiliation des abonnements</h2>
            <p className="text-ink-muted">
              Les abonnements sont à renouvellement automatique (mensuel ou annuel selon la formule choisie).
              Le Client peut résilier son abonnement à tout moment depuis son espace facturation (portail
              Stripe). La résiliation prend effet à la fin de la période en cours ; aucun remboursement
              prorata n&apos;est effectué.
            </p>
            <p className="text-ink-muted mt-2">
              En cas de défaut de paiement, l&apos;abonnement est automatiquement suspendu après notification
              par email. L&apos;accès aux crédits restants reste possible jusqu&apos;à expiration de la période
              payée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">6. Droit de rétractation</h2>
            <p className="text-ink-muted">
              Conformément à l&apos;article L221-18 du Code de la consommation, le Client consommateur
              dispose d&apos;un délai de <strong>14 jours</strong> à compter de la souscription pour exercer
              son droit de rétractation, sans avoir à motiver sa décision.
            </p>
            <p className="text-ink-muted mt-2">
              <strong>Exception — prestation de service exécutée :</strong> en cochant la case d&apos;acceptation
              des CGV lors de la commande, le Client demande expressément à ce que l&apos;exécution du
              service commence immédiatement, avant la fin du délai de rétractation. En conséquence, il
              <strong> renonce expressément à son droit de rétractation dès la première utilisation
              d&apos;un crédit</strong> (photo traitée ou reel généré), conformément à l&apos;article
              L221-28 1° du Code de la consommation.
            </p>
            <p className="text-ink-muted mt-2">
              Pour exercer son droit de rétractation avant toute utilisation de crédit, le Client doit
              envoyer un email à <a href="mailto:contact@pictaura.app" className="text-accent font-semibold hover:underline">contact@pictaura.app</a> en précisant
              son nom, son email de compte et la commande concernée. Le remboursement est effectué sous
              14 jours par le même moyen de paiement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">7. Remboursement pour dysfonctionnement</h2>
            <p className="text-ink-muted">
              En cas d&apos;échec technique du traitement d&apos;une photo, les crédits correspondants sont
              automatiquement recrédités sur le compte du Client. Aucune demande n&apos;est nécessaire.
            </p>
            <p className="text-ink-muted mt-2">
              En cas de dysfonctionnement avéré rendant le service inutilisable pendant plus de 72h
              consécutives, le Client peut demander un remboursement au prorata de la période non
              utilisée en contactant le support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">8. Responsabilité</h2>
            <p className="text-ink-muted">
              L&apos;Éditeur s&apos;engage à fournir le service conformément aux règles de l&apos;art. Sa
              responsabilité est strictement limitée au montant des sommes effectivement payées par le
              Client au cours des 12 derniers mois. L&apos;Éditeur ne saurait être tenu responsable des
              dommages indirects (perte d&apos;exploitation, manque à gagner, perte de données).
            </p>
            <p className="text-ink-muted mt-2">
              Le Client est seul responsable des photos qu&apos;il upload et de leur conformité à la
              législation en vigueur (droits d&apos;auteur, droit à l&apos;image, absence de contenu
              illicite).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">9. Données personnelles</h2>
            <p className="text-ink-muted">
              Le traitement des données personnelles est décrit dans la{" "}
              <Link href="/politique-confidentialite" className="text-accent font-semibold hover:underline">
                politique de confidentialité
              </Link>. Les photos uploadées sont conservées 30 jours maximum puis supprimées automatiquement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">10. Médiation et litiges</h2>
            <p className="text-ink-muted">
              En cas de litige, le Client consommateur peut, après avoir contacté le service client, saisir
              gratuitement le médiateur de la consommation compétent. Conformément à l&apos;article L612-1
              du Code de la consommation, le Client peut également recourir à la plateforme européenne de
              règlement en ligne des litiges :{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">
                ec.europa.eu/consumers/odr
              </a>.
            </p>
            <p className="text-ink-muted mt-2">
              À défaut d&apos;accord amiable, les tribunaux français seront seuls compétents. Les présentes
              CGV sont régies par le droit français.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">11. Contact</h2>
            <p className="text-ink-muted">
              Pour toute question relative aux CGV : <a href="mailto:contact@pictaura.app" className="text-accent font-semibold hover:underline">contact@pictaura.app</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
