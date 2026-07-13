import Link from "next/link";
import Logo from "@/components/brand/Logo";

/**
 * Footer partagé landing + /agences (extrait pour éviter la duplication et
 * la dérive entre les deux pages marketing).
 * `isHome` : sur la home, les liens "Produit" sont des ancres in-page
 * (#solutions...) ; ailleurs, ce sont des liens vers /#solutions (navigation
 * + scroll vers l'ancre).
 */
export default function SiteFooter({ isHome = true }: { isHome?: boolean }) {
  const anchor = (hash: string) => (isHome ? hash : `/${hash}`);

  return (
    <footer className="relative bg-brand text-cream border-t border-brand-light py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <Logo variant="mark" size={32} tone="cream" />
              <span className="text-cream font-display tracking-tight text-lg">
                Pictaura
              </span>
            </Link>
            <p className="text-cream/80 text-sm max-w-xs leading-relaxed">
              Retouche IA et SEO, gravés dans vos photos. Immobilier,
              réseaux sociaux, e-commerce — en moins de 30 secondes par photo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 text-sm">
            <div>
              <h3 className="font-display text-cream text-[10px] uppercase tracking-[0.15em] mb-4">
                Produit
              </h3>
              <ul className="space-y-3 text-cream/75">
                {[
                  [anchor("#solutions"), "Solutions"],
                  [anchor("#seo"), "SEO"],
                  [anchor("#pricing"), "Tarifs"],
                  ["/agences", "Agences"],
                ].map(([h, l]) => (
                  <li key={l}>
                    <a href={h} className="hover:text-sun transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-cream text-[10px] uppercase tracking-[0.15em] mb-4">
                Légal
              </h3>
              <ul className="space-y-3 text-cream/75">
                <li>
                  <Link href="/cgu" className="hover:text-sun transition-colors">
                    CGU
                  </Link>
                </li>
                <li>
                  <Link href="/cgv" className="hover:text-sun transition-colors">
                    CGV
                  </Link>
                </li>
                <li>
                  <Link href="/mentions-legales" className="hover:text-sun transition-colors">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link
                    href="/politique-confidentialite"
                    className="hover:text-sun transition-colors"
                  >
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-sun transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-cream/15 mb-8" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-cream/60">
            © {new Date().getFullYear()} Pictaura — Tous droits réservés
          </p>
          <div className="flex items-center gap-2 text-xs text-cream/60">
            <svg
              className="w-3.5 h-3.5 text-sun"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Paiement sécurisé SSL · Stripe
          </div>
        </div>
      </div>
    </footer>
  );
}
