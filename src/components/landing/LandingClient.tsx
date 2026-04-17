"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PLANS, FREE_SIGNUP_CREDITS, type PlanId } from "@/config/plans";
import BeforeAfterHero from "@/components/landing/BeforeAfterHero";
import Logo from "@/components/brand/Logo";
import {
  Home,
  Camera,
  ShoppingBag,
  Check,
  Zap,
  Search,
  FileText,
  Globe,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react";

/* ── Animations ───────────────────────────────────────────────── */
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

/* ── Brands marquee ───────────────────────────────────────────── */
const BRANDS: { name: string; color: string }[] = [
  { name: "Airbnb", color: "#FF5A5F" },
  { name: "Booking", color: "#003580" },
  { name: "Vinted", color: "#09B1BA" },
  { name: "Shopify", color: "#95BF47" },
  { name: "Instagram", color: "#E1306C" },
  { name: "Leboncoin", color: "#EC5A13" },
  { name: "SeLoger", color: "#E60E3D" },
  { name: "Etsy", color: "#F16521" },
  { name: "Facebook Marketplace", color: "#1877F2" },
  { name: "TikTok", color: "#010101" },
];

/* ── Dashboards data ──────────────────────────────────────────── */
type Dashboard = {
  planId: PlanId;
  name: string;
  tagline: string;
  Icon: typeof Home;
  accent: string;
  presetLabel: string;
  bullets: string[];
  imageUrl: string;
  beforeFilter: string;
  afterFilter: string;
};

const DASHBOARDS: Dashboard[] = [
  {
    planId: "immobilier",
    name: "Immobilier",
    tagline: "Des annonces qui se vendent plus vite",
    Icon: Home,
    accent: "#F87005",
    presetLabel: "Preset Immobilier",
    bullets: [
      "HDR adaptatif intérieur / extérieur",
      "Verticalité et lumière corrigées",
      "Ciel bleu et jardin verdoyants",
      "SEO gravé dans chaque photo",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85",
    beforeFilter: "grayscale(25%) brightness(0.72) contrast(0.82) saturate(0.5)",
    afterFilter: "brightness(1.18) saturate(1.3) contrast(1.1)",
  },
  {
    planId: "social",
    name: "Réseaux sociaux",
    tagline: "Un feed qui capte le regard",
    Icon: Camera,
    accent: "#E1306C",
    presetLabel: "Preset Instagram & Stories",
    bullets: [
      "Formats 1:1, 4:5 et 9:16 automatiques",
      "Rendu cinématique Orange & Teal",
      "Hashtags et alt text SEO générés",
      "Caption et alt text accrocheurs",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=85",
    beforeFilter: "grayscale(30%) brightness(0.78) contrast(0.85) saturate(0.5)",
    afterFilter: "brightness(1.1) saturate(1.35) contrast(1.1)",
  },
  {
    planId: "ecommerce",
    name: "E-commerce",
    tagline: "Des fiches produit prêtes à publier",
    Icon: ShoppingBag,
    accent: "#09B884",
    presetLabel: "Presets Shopify & Vinted",
    bullets: [
      "Fond blanc pur #FFFFFF",
      "Ombre portée douce réaliste",
      "JSON-LD Product schema.org",
      "Alt text et nom SEO auto-générés",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85",
    beforeFilter: "grayscale(20%) brightness(0.78) contrast(0.85) saturate(0.55)",
    afterFilter: "brightness(1.15) saturate(1.28) contrast(1.08)",
  },
];

/* ── FAQ item ─────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left bg-white/90 backdrop-blur-sm border border-ink-soft rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between p-6 gap-4">
        <span className="font-bold text-sm text-ink">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 w-5 h-5 text-accent"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </motion.span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <p className="text-ink-muted text-sm leading-relaxed px-6 pb-6 border-t border-ink-soft pt-4">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ── Dashboard card ───────────────────────────────────────────── */
function DashboardCard({ d, delay }: { d: Dashboard; delay: number }) {
  return (
    <FadeUp delay={delay}>
      <article
        className="group h-full rounded-3xl overflow-hidden bg-white/95 backdrop-blur-sm border border-ink-soft shadow-[0_20px_50px_rgba(3,29,104,0.12)] hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(3,29,104,0.18)] transition-all duration-300 flex flex-col"
        style={{ borderTop: `4px solid ${d.accent}` }}
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-soft">
          <BeforeAfterHero
            imageUrl={d.imageUrl}
            beforeFilter={d.beforeFilter}
            afterFilter={d.afterFilter}
          />
        </div>

        {/* Body */}
        <div className="p-7 flex flex-col flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${d.accent}18`, color: d.accent }}
            >
              <d.Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-ink text-lg leading-none">
                {d.name}
              </h3>
              <p className="text-[11px] text-ink-muted font-medium mt-1">
                {d.presetLabel}
              </p>
            </div>
          </div>

          <p className="text-ink-muted text-sm leading-relaxed mb-5">
            {d.tagline}.
          </p>

          <ul className="space-y-2.5 mb-7">
            {d.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-sm text-ink"
              >
                <Check
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{ color: d.accent }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className="mt-auto inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-white transition-transform hover:scale-[1.02]"
            style={{ background: d.accent }}
          >
            Essayer — 5 retouches offertes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>
    </FadeUp>
  );
}

/* ── Pricing card ─────────────────────────────────────────────── */
function PricingCard({
  plan,
  featured,
  delay,
}: {
  plan: (typeof PLANS)[number];
  featured: boolean;
  delay: number;
}) {
  return (
    <FadeUp delay={delay}>
      <div
        className={`relative h-full rounded-3xl p-8 backdrop-blur-sm border transition-all flex flex-col ${
          featured
            ? "bg-brand text-cream border-accent/40 shadow-[0_30px_70px_rgba(3,29,104,0.3)] scale-[1.02]"
            : "bg-white/95 text-ink border-ink-soft shadow-[0_20px_50px_rgba(3,29,104,0.1)] hover:-translate-y-1"
        }`}
      >
        {featured && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full shadow-lg">
            Le plus choisi
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: plan.accentColor }}
          />
          <h3
            className={`font-display text-lg ${
              featured ? "text-cream" : "text-ink"
            }`}
          >
            {plan.name}
          </h3>
        </div>

        <p
          className={`text-xs mb-6 ${
            featured ? "text-cream/80" : "text-ink-muted"
          }`}
        >
          {plan.tagline}
        </p>

        <div className="mb-5">
          <span
            className={`text-5xl font-display ${
              featured ? "text-sun" : "text-ink"
            }`}
          >
            {plan.priceDisplay.split("/")[0]}
          </span>
          <span
            className={`text-sm ml-1 ${
              featured ? "text-cream/80" : "text-ink-muted"
            }`}
          >
            /mois
          </span>
        </div>

        <div
          className={`text-sm font-bold mb-6 ${
            featured ? "text-cream" : "text-brand"
          }`}
        >
          {plan.creditsPerMonth} retouches par mois
        </div>

        <ul className="space-y-2.5 mb-8 text-sm">
          {plan.features.map((f) => (
            <li
              key={f}
              className={`flex items-start gap-2.5 ${
                featured ? "text-cream/90" : "text-ink"
              }`}
            >
              <Check
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  featured ? "text-sun" : ""
                }`}
                style={featured ? undefined : { color: plan.accentColor }}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/register"
          className={`mt-auto block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-all ${
            featured
              ? "bg-accent text-white hover:bg-accent-hover shadow-glow-sm hover:shadow-glow-md"
              : "bg-ink text-cream hover:bg-brand"
          }`}
        >
          Commencer avec {plan.name}
        </Link>
      </div>
    </FadeUp>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="relative text-ink">
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
            <Logo
              variant="mark"
              size={34}
              tone={scrolled ? "ink" : "cream"}
            />
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
                BY GK Technologies
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              ["#solutions", "Solutions"],
              ["#seo", "SEO"],
              ["#pricing", "Tarifs"],
              ["#faq", "FAQ"],
            ].map(([h, l]) => (
              <a
                key={h}
                href={h}
                className={`text-sm font-bold transition-colors ${
                  scrolled
                    ? "text-ink-muted hover:text-brand"
                    : "text-cream/85 hover:text-sun"
                }`}
              >
                {l}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={`text-sm font-bold transition-colors hidden md:block ${
                scrolled
                  ? "text-ink-muted hover:text-brand"
                  : "text-cream/85 hover:text-sun"
              }`}
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="btn-primary text-sm py-2.5 px-5"
            >
              Essai gratuit <span className="opacity-80">→</span>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden pt-28 pb-20">
        {/* Dark scrim pour lisibilité du texte */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to right, rgba(3,29,104,0.78) 0%, rgba(3,29,104,0.55) 40%, rgba(3,29,104,0.15) 75%, transparent 100%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Left : copy */}
          <div className="text-cream">
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md text-cream mb-8">
                <Eye className="w-3.5 h-3.5 text-sun" />
                {FREE_SIGNUP_CREDITS} retouches offertes · Sans carte bancaire
              </span>
            </motion.div>

            <motion.h1
              className="text-display-xl font-display tracking-tight leading-[1.02] mb-6"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            >
              <span className="text-cream">Retouche IA</span>
              <br />
              <span className="text-cream">et SEO intégré,</span>
              <br />
              <span className="gradient-text">gravés dans la photo.</span>
            </motion.h1>

            <motion.p
              className="text-cream/85 text-lg leading-relaxed max-w-lg mb-10"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            >
              Pictaura retouche vos visuels et écrit le SEO directement
              dans le fichier — alt text, nom, description, schema.org. Prêt à
              publier sur Shopify, Instagram ou une annonce immobilière en 30
              secondes.
            </motion.p>

            <motion.div
              className="flex gap-3 flex-wrap mb-10"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            >
              <Link href="/register" className="btn-primary">
                Essayer gratuitement
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#solutions" className="btn-ghost-light">
                Voir les 3 solutions
              </a>
            </motion.div>

            <motion.div
              className="flex flex-wrap gap-x-5 gap-y-2"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            >
              {[
                "Immobilier · Social · E-commerce",
                "Résultat en 30 secondes",
                "Sans carte bancaire",
              ].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-xs text-cream/85 font-medium"
                >
                  <Check className="w-3.5 h-3.5 text-sun flex-shrink-0" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right : before/after */}
          <motion.div
            className="relative h-[460px]"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-3xl scale-95 pointer-events-none" />
            <div className="relative h-full rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(248,112,5,0.35)]">
              <BeforeAfterHero
                imageUrl="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&q=85"
                beforeFilter="grayscale(25%) brightness(0.72) contrast(0.82) saturate(0.5)"
                afterFilter="brightness(1.18) saturate(1.3) contrast(1.1)"
              />
            </div>
            <motion.div
              className="absolute -top-4 -left-4 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-2.5 z-10 shadow-lg"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <div className="text-[10px] font-bold text-ink">
                  Retouche IA + SEO
                </div>
                <div className="text-[10px] text-emerald-600 font-bold">
                  Prêt à publier
                </div>
              </div>
            </motion.div>
            <motion.div
              className="absolute -bottom-4 -right-4 bg-brand rounded-xl px-4 py-3 z-10 border border-sun/40 shadow-lg"
              animate={{ y: [0, 6, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
            >
              <div className="text-[10px] text-sun font-bold">Temps IA</div>
              <div className="text-base font-display text-cream flex items-center gap-1">
                ~30 sec <Zap className="w-4 h-4 text-sun" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── BRAND MARQUEE ─────────────────────────────────────── */}
      <section className="relative py-10 overflow-hidden border-y border-ink/10">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "rgba(255, 251, 245, 0.78)" }}
        />
        <div className="relative">
          <p className="text-center text-[11px] font-bold tracking-[0.18em] uppercase text-ink-muted mb-6">
            Optimisé pour les plateformes que vous utilisez
          </p>
          <div
            className="relative overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="flex gap-14 whitespace-nowrap w-max animate-marquee">
              {[...BRANDS, ...BRANDS].map((b, i) => (
                <span
                  key={`${b.name}-${i}`}
                  className="text-2xl md:text-3xl font-display tracking-tight flex-shrink-0"
                  style={{ color: b.color }}
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 DASHBOARDS ──────────────────────────────────────── */}
      <section id="solutions" className="relative py-28 px-6">
        {/* Voile clair pour asseoir le contenu */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "rgba(255, 251, 245, 0.72)" }}
        />
        <div className="relative max-w-7xl mx-auto">
          <FadeUp className="text-center mb-16 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent mb-5">
              <Sparkles className="w-3.5 h-3.5" />3 solutions spécialisées
            </span>
            <h2 className="text-display-lg font-display text-ink mb-4 leading-[1.05]">
              Un dashboard
              <br />
              <span className="gradient-text">pour chaque métier</span>
            </h2>
            <p className="text-ink-muted leading-relaxed">
              Chaque plan Pictaura active un preset dédié, des formats adaptés
              et un SEO pensé pour votre cible — immobilier, réseaux sociaux ou
              e-commerce.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-7">
            {DASHBOARDS.map((d, i) => (
              <DashboardCard key={d.planId} d={d} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO DIFFERENTIATOR ────────────────────────────────── */}
      <section id="seo" className="relative py-28 px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to bottom, rgba(3,29,104,0.85) 0%, rgba(3,29,104,0.72) 100%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto">
          <FadeUp className="text-center mb-14 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-sun/40 bg-sun/10 text-sun mb-5">
              <Globe className="w-3.5 h-3.5" />
              Le différenciateur Pictaura
            </span>
            <h2 className="text-display-lg font-display text-cream mb-4 leading-[1.05]">
              Vos photos optimisées pour le référencement,
              <br />
              <span className="gradient-text">gravées dans le fichier.</span>
            </h2>
            <p className="text-cream/80 leading-relaxed">
              Personne ne fait ça sur ce segment. Chaque photo Pictaura
              embarque ses métadonnées SEO directement dans le fichier —
              les moteurs de recherche, Shopify et WordPress les lisent automatiquement.
            </p>
          </FadeUp>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left : bullets */}
            <FadeUp>
              <ul className="space-y-4">
                {[
                  {
                    Icon: FileText,
                    title: "Alt text SEO optimisé",
                    desc: "Généré par l'IA selon le contexte de la photo et votre preset métier.",
                  },
                  {
                    Icon: Search,
                    title: "Nom de fichier sémantique",
                    desc: "salon-lumineux-appartement-paris.jpg plutôt que IMG_4521.jpg.",
                  },
                  {
                    Icon: Globe,
                    title: "Description & mots-clés EXIF",
                    desc: "Gravés dans les métadonnées IPTC du fichier, lus nativement par Shopify et WordPress.",
                  },
                  {
                    Icon: Sparkles,
                    title: "Schema.org JSON-LD",
                    desc: "Product, ImageObject, RealEstateListing — les algorithmes comprennent immédiatement votre contenu.",
                  },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="flex gap-4 bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sun/20 border border-sun/40 flex items-center justify-center flex-shrink-0">
                      <item.Icon className="w-5 h-5 text-sun" />
                    </div>
                    <div>
                      <h3 className="font-display text-cream text-sm mb-1">
                        {item.title}
                      </h3>
                      <p className="text-cream/75 text-xs leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </FadeUp>

            {/* Right : mockup EXIF */}
            <FadeUp delay={0.15}>
              <div className="rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
                <div className="bg-ink/90 border-b border-white/10 px-5 py-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-[11px] text-cream/60 font-mono ml-3">
                    salon-lumineux-appartement-paris.jpg — EXIF
                  </span>
                </div>
                <div className="bg-ink/95 p-6 font-mono text-[12px] leading-relaxed text-cream/90">
                  <div>
                    <span className="text-sun">alt</span>:{" "}
                    <span className="text-cream/85">
                      &quot;Salon lumineux avec parquet en chêne, appartement 3
                      pièces rénové à Paris 11&quot;
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sun">title</span>:{" "}
                    <span className="text-cream/85">
                      &quot;Appartement 3P Paris 11 — Salon rénové&quot;
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sun">description</span>:{" "}
                    <span className="text-cream/85">
                      &quot;Salon de 25m² avec grandes fenêtres, parquet
                      chêne massif, cheminée d&apos;origine...&quot;
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sun">keywords</span>:{" "}
                    <span className="text-cream/85">
                      appartement-paris-11, salon-lumineux, parquet-chene,
                      renove
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <span className="text-sun">@context</span>:{" "}
                    <span className="text-cream/60">
                      https://schema.org
                    </span>
                  </div>
                  <div>
                    <span className="text-sun">@type</span>:{" "}
                    <span className="text-cream/85">
                      &quot;RealEstateListing&quot;
                    </span>
                  </div>
                  <div>
                    <span className="text-sun">image</span>:{" "}
                    <span className="text-cream/85">ImageObject...</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-cream/60 text-xs mt-4">
                Aperçu réel des métadonnées générées par Pictaura sur une
                photo Immobilier.
              </p>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section id="pricing" className="relative py-28 px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "rgba(255, 251, 245, 0.82)" }}
        />
        <div className="relative max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-brand/25 bg-brand/10 text-brand mb-5">
              Tarifs transparents
            </span>
            <h2 className="text-display-lg font-display text-ink mb-4 leading-[1.05]">
              49,90€/mois, 500 retouches,
              <br />
              <span className="gradient-text">choisissez votre angle.</span>
            </h2>
            <p className="text-ink-muted leading-relaxed">
              Tous les plans démarrent avec {FREE_SIGNUP_CREDITS} retouches
              offertes à l&apos;inscription. Sans carte bancaire. Sans
              engagement.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                featured={i === 1}
                delay={i * 0.1}
              />
            ))}
          </div>

          <p className="text-center text-xs text-ink-muted mt-10">
            Remboursement automatique en cas d&apos;échec de traitement ·{" "}
            <a
              href="#faq"
              className="underline hover:text-brand transition-colors"
            >
              Questions sur les tarifs&nbsp;?
            </a>
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="relative py-24 px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "rgba(255, 251, 245, 0.85)" }}
        />
        <div className="relative max-w-3xl mx-auto">
          <FadeUp className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent mb-5">
              FAQ
            </span>
            <h2 className="text-display-md font-display text-ink">
              Questions fréquentes
            </h2>
          </FadeUp>

          <div className="space-y-3">
            {[
              {
                q: "Qu'est-ce qui distingue Pictaura d'un filtre photo classique ?",
                a: "Pictaura ne se contente pas de retoucher : il grave le SEO (alt text, nom de fichier sémantique, description, mots-clés, schema.org) directement dans le fichier. Shopify, WordPress et les moteurs de recherche lisent ces métadonnées automatiquement. Vous gagnez en visibilité sur tous les algorithmes.",
              },
              {
                q: "Comment fonctionnent les 3 plans ?",
                a: "Chaque plan coûte 49,90€/mois et inclut 500 retouches mensuelles. Ils activent un preset spécialisé : Immobilier (HDR, verticalité), Réseaux sociaux (formats Insta, filtre cinématique) ou E-commerce (fond blanc Shopify, ombre douce). Vous choisissez celui qui correspond à votre métier.",
              },
              {
                q: "Puis-je tester avant de payer ?",
                a: `Oui : ${FREE_SIGNUP_CREDITS} retouches sont offertes à l'inscription, sans carte bancaire. Ces 5 photos portent un logo Pictaura transparent qui disparaît dès que vous choisissez un plan.`,
              },
              {
                q: "Comment est généré le SEO de chaque photo ?",
                a: "L'IA analyse l'image (meubles, luminosité, contexte), puis génère alt text, description, nom de fichier, mots-clés, meta title et hashtags. Tout est injecté dans les champs EXIF/IPTC du fichier. À l'import Shopify ou WordPress, les champs sont pré-remplis automatiquement.",
              },
              {
                q: "Quels formats et tailles sont acceptés ?",
                a: "JPEG, PNG, WEBP, HEIC et HEIF. Jusqu'à 50 Mo par photo — compatible avec les reflex professionnels. 5 photos maximum par lot pour garder un résultat optimal en 30 secondes.",
              },
              {
                q: "Puis-je annuler mon abonnement ?",
                a: "Oui, à tout moment depuis votre espace facturation. Vous gardez l'accès jusqu'à la fin de la période en cours. Aucun frais caché, aucun engagement.",
              },
              {
                q: "Mes photos sont-elles stockées en sécurité ?",
                a: "Oui. Les photos sont hébergées sur Cloudflare R2 (serveurs européens, chiffrés) et supprimées automatiquement après 30 jours. Vous pouvez les effacer manuellement à tout moment depuis votre dashboard.",
              },
            ].map((item) => (
              <FadeUp key={item.q} delay={0.05}>
                <FaqItem q={item.q} a={item.a} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────── */}
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
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md text-cream mb-8">
            <Eye className="w-3.5 h-3.5 text-sun" />
            Prêt à publier, prêt à indexer
          </span>
          <h2 className="text-display-xl font-display mb-6 text-cream leading-[1.02]">
            Vos photos méritent
            <br />
            <span className="gradient-text">d&apos;être vues.</span>
          </h2>
          <p className="text-cream/85 mb-12 leading-relaxed text-lg">
            Rejoignez les agences, e-commerçants et créateurs qui gagnent du
            temps — et du référencement — avec Pictaura.
          </p>
          <Link
            href="/register"
            className="btn-primary text-base py-5 px-10 shadow-glow-lg inline-flex"
          >
            Commencer — {FREE_SIGNUP_CREDITS} retouches offertes
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-cream/60 text-xs mt-6">
            Sans carte bancaire · Sans engagement · Résultat en 30 secondes
          </p>
        </FadeUp>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
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
                réseaux sociaux, e-commerce — en 30 secondes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-sm">
              <div>
                <h3 className="font-display text-cream text-[10px] uppercase tracking-[0.15em] mb-4">
                  Produit
                </h3>
                <ul className="space-y-3 text-cream/75">
                  {[
                    ["#solutions", "Solutions"],
                    ["#seo", "SEO"],
                    ["#pricing", "Tarifs"],
                    ["#faq", "FAQ"],
                  ].map(([h, l]) => (
                    <li key={h}>
                      <a
                        href={h}
                        className="hover:text-sun transition-colors"
                      >
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
                    <Link
                      href="/cgu"
                      className="hover:text-sun transition-colors"
                    >
                      CGU
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
                    <Link
                      href="/contact"
                      className="hover:text-sun transition-colors"
                    >
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
    </div>
  );
}
