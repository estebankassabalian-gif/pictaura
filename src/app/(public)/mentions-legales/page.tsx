import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales — Pictaura",
  description: "Mentions légales de Pictaura — éditeur, hébergeur, contact.",
  robots: { index: false },
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-accent text-sm font-semibold hover:underline mb-8 inline-block">
          ← Retour à l&apos;accueil
        </Link>

        <h1 className="text-4xl md:text-5xl font-display tracking-tight text-ink mb-3">Mentions légales</h1>
        <p className="text-ink-muted text-sm mb-10">Dernière mise à jour : avril 2026</p>

        <div className="prose max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-display text-ink mb-3">1. Éditeur du site</h2>
            <p className="text-ink-muted">
              Le site Pictaura (accessible à l&apos;adresse pictaura.app) est édité par :
            </p>
            <ul className="text-ink-muted mt-2 space-y-1 list-disc list-inside">
              <li><strong>Esteban Kassabalian</strong></li>
              <li>Entrepreneur individuel (micro-entreprise)</li>
              <li>Adresse : {`{{à compléter — adresse complète à Draguignan}}`}</li>
              <li>SIRET : {`{{à compléter}}`}</li>
              <li>Email : <a href="mailto:contact@pictaura.app" className="text-accent font-semibold hover:underline">contact@pictaura.app</a></li>
              <li>TVA intracommunautaire : {`{{à compléter si applicable — sinon mention "TVA non applicable, art. 293 B du CGI"}}`}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">2. Directeur de la publication</h2>
            <p className="text-ink-muted">
              Esteban Kassabalian, en qualité d&apos;éditeur du site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">3. Hébergement</h2>
            <p className="text-ink-muted">
              Le site est hébergé par :
            </p>
            <ul className="text-ink-muted mt-2 space-y-1 list-disc list-inside">
              <li><strong>Hetzner Online GmbH</strong></li>
              <li>Industriestr. 25, 91710 Gunzenhausen, Allemagne</li>
              <li>Téléphone : +49 9831 505-0</li>
              <li>Site web : <a href="https://www.hetzner.com" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">www.hetzner.com</a></li>
            </ul>
            <p className="text-ink-muted mt-3">
              Les photos uploadées sont stockées sur Cloudflare R2 (Cloudflare, Inc., 101 Townsend St,
              San Francisco, CA 94107, USA) — datacenters européens.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">4. Propriété intellectuelle</h2>
            <p className="text-ink-muted">
              L&apos;ensemble des éléments du site (textes, images, logo, code, design) est la propriété
              exclusive de l&apos;Éditeur et est protégé par le droit français et international de la
              propriété intellectuelle. Toute reproduction, représentation ou diffusion, totale ou partielle,
              est interdite sans autorisation écrite préalable.
            </p>
            <p className="text-ink-muted mt-2">
              Les photos uploadées par les utilisateurs restent leur entière propriété. L&apos;Éditeur ne
              revendique aucun droit sur celles-ci.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">5. Données personnelles</h2>
            <p className="text-ink-muted">
              Le traitement des données personnelles est décrit dans notre{" "}
              <Link href="/politique-confidentialite" className="text-accent font-semibold hover:underline">
                politique de confidentialité
              </Link>.
            </p>
            <p className="text-ink-muted mt-2">
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
              Informatique et Libertés, vous disposez d&apos;un droit d&apos;accès, de rectification,
              d&apos;effacement et de portabilité de vos données. Pour exercer ces droits, contactez{" "}
              <a href="mailto:contact@pictaura.app" className="text-accent font-semibold hover:underline">contact@pictaura.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">6. Cookies</h2>
            <p className="text-ink-muted">
              Pictaura utilise uniquement des cookies techniques strictement nécessaires au fonctionnement
              du site (session d&apos;authentification). Aucun cookie de traçage ou publicitaire n&apos;est
              déposé. Ces cookies techniques ne nécessitent pas de consentement préalable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">7. Loi applicable et juridiction</h2>
            <p className="text-ink-muted">
              Les présentes mentions légales sont régies par le droit français. En cas de litige et à défaut
              d&apos;accord amiable, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-ink mb-3">8. Contact</h2>
            <p className="text-ink-muted">
              Pour toute question : <a href="mailto:contact@pictaura.app" className="text-accent font-semibold hover:underline">contact@pictaura.app</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
