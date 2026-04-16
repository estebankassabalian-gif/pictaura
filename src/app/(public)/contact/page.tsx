import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Pictaura",
  description: "Contactez l'équipe Pictaura pour toute question sur le service de retouche photo IA.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/" className="text-accent text-sm font-semibold hover:underline mb-8 inline-block">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-4xl md:text-5xl font-display tracking-tight text-ink mb-3">Contact</h1>
        <p className="text-ink-muted mb-10">Une question ? On répond sous 24h.</p>

        <div className="space-y-6">
          <div className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-ink mb-1">Email</h2>
            <a href="mailto:contact@pictaura.app" className="text-accent hover:underline font-semibold">
              contact@pictaura.app
            </a>
          </div>

          <div className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-ink mb-1">Support technique</h2>
            <p className="text-ink-muted text-sm">
              Pour tout problème avec le traitement de vos photos, précisez votre email de compte
              et le type de preset utilisé.
            </p>
          </div>

          <div className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-ink mb-1">Données personnelles</h2>
            <p className="text-ink-muted text-sm">
              Pour exercer vos droits RGPD (accès, rectification, suppression), contactez-nous à la même adresse.
              Consultez notre{" "}
              <Link href="/politique-confidentialite" className="text-accent hover:underline font-semibold">
                politique de confidentialité
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
