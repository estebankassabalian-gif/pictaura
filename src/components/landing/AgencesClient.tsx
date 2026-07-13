"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Check,
  Zap,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import { PLANS, FREE_SIGNUP_CREDITS, formatEur } from "@/config/plans";
import BeforeAfterHero from "@/components/landing/BeforeAfterHero";
import SeoProofCard from "@/components/landing/SeoProofCard";
import SiteFooter from "@/components/landing/SiteFooter";
import Logo from "@/components/brand/Logo";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <motion.div
      initial={false}
      animate={mounted ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const PORTALS = ["Airbnb", "SeLoger", "Leboncoin", "Booking", "Instagram"];

// Business plan = le plus adapté à un volume d'agence courant.
const AGENCY_PLAN = PLANS.find((p) => p.id === "business") ?? PLANS[PLANS.length - 1];

const COMPARISON = [
  {
    name: "Pictaura",
    delay: "< 30 secondes",
    price: `dès ${formatEur(PLANS[0].monthlyPriceEurCents)}/mois`,
    seo: true,
    highlight: true,
  },
  {
    name: "Photographe professionnel",
    delay: "Sur rendez-vous, 1 à 3 jours",
    price: "150 à 300 € / bien",
    seo: false,
    highlight: false,
  },
  {
    name: "Retoucheur freelance",
    delay: "24 à 48 h",
    price: "1 à 3 € / photo",
    seo: false,
    highlight: false,
  },
  {
    name: "Service de retouche en ligne",
    delay: "24 à 48 h",
    price: "~1,50 $ / photo",
    seo: false,
    highlight: false,
  },
];

export default function AgencesClient() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="relative text-ink bg-cream">
      {/* ── NAV ───────────────────────────────────────────────── */}
      <motion.nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "bg-cream/85 backdrop-blur-xl border-b border-ink-soft shadow-card"
            : "bg-transparent"
        }`}
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="mark" size={34} tone={scrolled ? "ink" : "cream"} />
            <div className="flex flex-col leading-none">
              <span
                className={`font-display tracking-tight text-lg ${
                  scrolled ? "text-ink" : "text-cream"
                }`}
              >
                Pictaura
              </span>
              <span
                className={`text-[9px] font-medium tracking-wider uppercase ${
                  scrolled ? "text-ink-muted" : "text-cream/70"
                }`}
              >
                Pour les agences
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={`text-sm font-bold transition-colors hidden sm:inline ${
                scrolled ? "text-ink-muted hover:text-brand" : "text-cream/85 hover:text-sun"
              }`}
            >
              Connexion
            </Link>
            <Link href="/register" className="btn-primary text-sm py-2.5 px-5">
              Essai gratuit <span className="opacity-80">→</span>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-[86vh] flex items-center overflow-hidden pt-32 pb-20">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to right, rgba(3,29,104,0.82) 0%, rgba(3,29,104,0.6) 40%, rgba(3,29,104,0.18) 75%, transparent 100%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-cream">
            <FadeUp>
              <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md text-cream mb-8">
                <Building2 className="w-3.5 h-3.5 text-sun" />
                Pictaura pour les agences immobilières
              </span>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h1 className="text-display-xl font-display tracking-tight leading-[1.02] mb-6">
                <span className="text-cream">Des annonces qui se vendent</span>
                <br />
                <span className="gradient-text">plus vite, publiées plus tôt.</span>
              </h1>
            </FadeUp>

            <FadeUp delay={0.2}>
              <p className="text-cream/85 text-lg leading-relaxed max-w-lg mb-10">
                Vos photos de biens, retouchées et référencées en moins de
                30 secondes. Testez sur vos propres annonces avant d&apos;engager
                votre agence — sans carte bancaire.
              </p>
            </FadeUp>

            <FadeUp delay={0.3} className="flex gap-3 flex-wrap mb-10">
              <Link href="/register" className="btn-primary">
                Essayer sur vos photos — {FREE_SIGNUP_CREDITS} offertes
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="mailto:contact@pictaura.app" className="btn-ghost-light">
                Discuter avec nous
              </a>
            </FadeUp>

            <FadeUp delay={0.4} className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                "SEO gravé dans chaque photo",
                "Résultat en moins de 30 secondes",
                "Sans engagement",
              ].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-xs text-cream/85 font-medium"
                >
                  <Check className="w-3.5 h-3.5 text-sun flex-shrink-0" />
                  {t}
                </span>
              ))}
            </FadeUp>
          </div>

          <motion.div
            className="relative h-[420px]"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-3xl scale-95 pointer-events-none" />
            <div className="relative h-full rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(248,112,5,0.35)]">
              <BeforeAfterHero
                imageUrl="/demo/villa-avant.jpg"
                afterImageUrl="/demo/villa-apres.jpg"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PLATEFORMES ───────────────────────────────────────── */}
      <section className="relative py-8 px-6 border-y border-ink/10 bg-white">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-ink-muted mr-2">
            Prêt à publier sur
          </span>
          {PORTALS.map((p) => (
            <span key={p} className="font-display text-ink-muted text-sm">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* ── COMPARATIF ────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-14 max-w-2xl mx-auto">
            <span className="tag mb-5">Le comparatif</span>
            <h2 className="text-display-lg font-display text-ink mb-4 leading-[1.05]">
              Le même résultat, en{" "}
              <span className="gradient-text-warm">une fraction du temps</span>
            </h2>
            <p className="text-ink-muted leading-relaxed">
              Prix indicatifs constatés sur le marché, à titre de comparaison.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="overflow-x-auto rounded-2xl border border-ink-soft shadow-[0_10px_30px_rgba(3,29,104,0.06)]">
              <table className="w-full text-sm min-w-[560px] bg-white">
                <thead>
                  <tr className="border-b border-ink-soft">
                    <th className="text-left px-6 py-4 font-display text-ink">Solution</th>
                    <th className="text-left px-6 py-4 font-display text-ink">Délai</th>
                    <th className="text-left px-6 py-4 font-display text-ink">Prix indicatif</th>
                    <th className="text-left px-6 py-4 font-display text-ink">SEO gravé</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr
                      key={row.name}
                      className={`border-b border-ink-soft last:border-0 ${
                        row.highlight ? "bg-accent/5" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-ink">
                        {row.name}
                        {row.highlight && (
                          <span className="ml-2 tag align-middle">Pictaura</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-muted">{row.delay}</td>
                      <td className="px-6 py-4 text-ink-muted">{row.price}</td>
                      <td className="px-6 py-4">
                        {row.seo ? (
                          <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                            <Check className="w-4 h-4" /> Oui
                          </span>
                        ) : (
                          <span className="text-ink-muted/60">Non</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── POURQUOI PICTAURA ────────────────────────────────── */}
      <section className="relative py-24 px-6 bg-white border-y border-ink/10">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-14 max-w-2xl mx-auto">
            <span className="tag-navy mb-5">Pourquoi les agences choisissent Pictaura</span>
            <h2 className="text-display-lg font-display text-ink leading-[1.05]">
              Construit pour le rythme d&apos;une agence
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                Icon: Zap,
                title: "Moins de 30 secondes par photo",
                desc: "Un lot de 30 photos traité en parallèle. Publiez vos annonces le jour même du mandat.",
              },
              {
                Icon: Sparkles,
                title: "Le SEO, gravé dans le fichier",
                desc: "Alt text, description, mots-clés, schema.org RealEstateListing — injectés dans chaque photo, lus par Google et les portails.",
              },
              {
                Icon: Layers,
                title: "Multi-plateforme natif",
                desc: "Formats et tonalité adaptés à Airbnb, SeLoger, Leboncoin, Instagram — sans retravail manuel.",
              },
            ].map((item) => (
              <FadeUp key={item.title} delay={0.1}>
                <div className="h-full bg-cream border border-ink-soft rounded-3xl p-7">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                    <item.Icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-display text-ink text-lg mb-2">{item.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO DÉMONTRÉ ──────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: "linear-gradient(to bottom, rgba(3,29,104,0.85) 0%, rgba(3,29,104,0.72) 100%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <FadeUp>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-sun/40 bg-sun/10 text-sun mb-5">
              <MapPin className="w-3.5 h-3.5" />
              Exemple réel
            </span>
            <h2 className="text-display-lg font-display text-cream mb-4 leading-[1.05]">
              Vos annonces, trouvées avant celles de vos confrères
            </h2>
            <p className="text-cream/80 leading-relaxed mb-10 max-w-2xl mx-auto">
              Voici les métadonnées réellement générées par Pictaura sur une
              photo — pas un exemple fictif.
            </p>
          </FadeUp>
          <FadeUp delay={0.1} className="max-w-xl mx-auto">
            <SeoProofCard />
          </FadeUp>
        </div>
      </section>

      {/* ── OFFRE AGENCE ──────────────────────────────────────── */}
      <section className="relative py-24 px-6 bg-white border-y border-ink/10">
        <div className="max-w-3xl mx-auto text-center">
          <FadeUp>
            <span className="tag mb-5">Tarif recommandé</span>
            <h2 className="text-display-lg font-display text-ink mb-4 leading-[1.05]">
              Le plan {AGENCY_PLAN.name}, pensé pour un volume d&apos;agence
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="bg-brand rounded-3xl p-10 text-cream shadow-[0_20px_50px_rgba(3,29,104,0.25)]">
              <div className="flex items-center justify-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-sun" />
                <span className="text-sun font-bold text-sm uppercase tracking-wider">
                  {AGENCY_PLAN.name}
                </span>
              </div>
              <div className="font-display text-5xl mb-2">
                {formatEur(AGENCY_PLAN.monthlyPriceEurCents)}
                <span className="text-lg text-cream/70 font-normal">/mois</span>
              </div>
              <p className="text-cream/80 mb-8">
                {AGENCY_PLAN.creditsPerMonth} retouches IA par mois — SEO gravé,
                sans engagement.
              </p>
              <Link
                href="/register"
                className="btn-primary text-base py-4 px-8 inline-flex mb-4"
              >
                Commencer avec {AGENCY_PLAN.name}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-cream/60 text-xs">
                Besoin de plus de {AGENCY_PLAN.creditsPerMonth} photos par mois ?{" "}
                <a href="mailto:contact@pictaura.app" className="text-sun underline">
                  Contactez-nous
                </a>{" "}
                — ou{" "}
                <Link href="/#pricing" className="text-sun underline">
                  voir tous les plans
                </Link>
                .
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeUp className="text-center mb-12">
            <h2 className="text-display-lg font-display text-ink leading-[1.05]">
              Questions fréquentes des agences
            </h2>
          </FadeUp>
          <div className="space-y-4">
            {[
              {
                q: "Puis-je tester sur mes propres annonces avant de m'engager ?",
                a: `Oui : ${FREE_SIGNUP_CREDITS} retouches sont offertes à l'inscription, sans carte bancaire. Uploadez vos propres photos de biens et jugez le résultat avant tout engagement.`,
              },
              {
                q: "Le SEO fonctionne-t-il sur Airbnb, SeLoger ou Leboncoin ?",
                a: "Le SEO est gravé directement dans le fichier photo (EXIF/IPTC) et accompagné d'un JSON-LD schema.org RealEstateListing. Toutes les plateformes qui lisent ces standards en bénéficient.",
              },
              {
                q: "Puis-je annuler à tout moment ?",
                a: "Oui, à tout moment depuis votre espace facturation. Vous gardez l'accès jusqu'à la fin de la période en cours. Aucun frais caché, aucun engagement.",
              },
              {
                q: "Comment sont protégées les photos de nos mandats ?",
                a: "Le détail du traitement de vos données (sous-traitants, durées de conservation, sécurité) est disponible dans notre politique de confidentialité.",
              },
            ].map((item) => (
              <FadeUp key={item.q}>
                <div className="bg-white border border-ink-soft rounded-2xl p-6">
                  <h3 className="font-bold text-sm text-ink mb-2">{item.q}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    {item.q.includes("protégées") ? (
                      <>
                        Le détail du traitement de vos données (sous-traitants,
                        durées de conservation, sécurité) est disponible dans
                        notre{" "}
                        <Link
                          href="/politique-confidentialite"
                          className="text-accent font-semibold underline"
                        >
                          politique de confidentialité
                        </Link>
                        .
                      </>
                    ) : (
                      item.a
                    )}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(3,29,104,0.75) 0%, rgba(3,29,104,0.55) 50%, rgba(3,29,104,0.25) 100%)",
          }}
        />
        <FadeUp className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-display-xl font-display mb-6 text-cream leading-[1.02]">
            Vos prochaines annonces
            <br />
            <span className="gradient-text">méritent d&apos;être vues.</span>
          </h2>
          <p className="text-cream/85 mb-12 leading-relaxed text-lg">
            {FREE_SIGNUP_CREDITS} retouches offertes, sans carte bancaire.
          </p>
          <Link
            href="/register"
            className="btn-primary text-base py-5 px-10 shadow-glow-lg inline-flex"
          >
            Essayer sur mes photos
            <ArrowRight className="w-5 h-5" />
          </Link>
        </FadeUp>
      </section>

      <SiteFooter isHome={false} />
    </div>
  );
}
