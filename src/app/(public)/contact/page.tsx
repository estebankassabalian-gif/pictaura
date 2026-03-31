import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Pictaura",
  description: "Contactez l'équipe Pictaura pour toute question sur le service de retouche photo IA.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/" className="text-brand-600 text-sm hover:underline mb-8 inline-block">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Contact</h1>
        <p className="text-zinc-500 mb-10">Une question ? On répond sous 24h.</p>

        <div className="space-y-6">
          <div className="bg-[#0a0a0a] rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-1">Email</h2>
            <a href="mailto:contact@pictaura.app" className="text-brand-600 hover:underline">
              contact@pictaura.app
            </a>
          </div>

          <div className="bg-[#0a0a0a] rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-1">Support technique</h2>
            <p className="text-zinc-400 text-sm">
              Pour tout problème avec le traitement de vos photos, précisez votre email de compte
              et le type de preset utilisé.
            </p>
          </div>

          <div className="bg-[#0a0a0a] rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-1">Données personnelles</h2>
            <p className="text-zinc-400 text-sm">
              Pour exercer vos droits RGPD (accès, rectification, suppression), contactez-nous à la même adresse.
              Consultez notre{" "}
              <Link href="/politique-confidentialite" className="text-brand-600 hover:underline">
                politique de confidentialité
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
