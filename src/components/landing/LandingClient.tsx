"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PLANS,
  ONESHOT_PACK,
  FREE_SIGNUP_CREDITS,
  formatEur,
  getPriceEurCents,
  type BillingInterval,
} from "@/config/plans";

// Segments marketing sur la landing (découplés des plans de pricing).
type SegmentId = "immobilier" | "social" | "ecommerce";
import BeforeAfterHero from "@/components/landing/BeforeAfterHero";
import SiteFooter from "@/components/landing/SiteFooter";
import SeoProofCard from "@/components/landing/SeoProofCard";
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
  segmentId: SegmentId;
  name: string;
  tagline: string;
  Icon: typeof Home;
  accent: string;
  presetLabel: string;
  bullets: string[];
  imageUrl: string;
  beforeFilter: string;
  afterFilter: string;
  /** Vraie photo "après" (retouche Pictaura réelle) — désactive la simulation
   *  par filtre CSS quand fournie. Voir BeforeAfterHero. */
  afterImageUrl?: string;
};

const DASHBOARDS: Dashboard[] = [
  {
    segmentId: "immobilier",
    name: "Immobilier",
    tagline: "Des annonces qui se vendent plus vite",
    Icon: Home,
    accent: "#F87005",
    presetLabel: "Preset Immobilier",
    bullets: [
      "HDR adaptatif intérieur / extérieur",
      "Lumière et couleurs corrigées",
      "Piscine assainie, terrasse dégagée",
      "SEO gravé dans chaque photo",
    ],
    // VRAIE retouche Pictaura (villa Var, même paire que le hero) : la
    // piscine verte redevient limpide, la terrasse se dégage. Cohérent avec
    // les puces ci-dessus — plus une simulation par filtre CSS.
    imageUrl: "/demo/villa-avant.jpg",
    afterImageUrl: "/demo/villa-apres.jpg",
    beforeFilter: "",
    afterFilter: "",
  },
  {
    segmentId: "social",
    name: "Réseaux sociaux",
    tagline: "Un feed qui capte le regard",
    Icon: Camera,
    accent: "#E1306C",
    presetLabel: "Preset Instagram & Stories",
    bullets: [
      "Personnes et badauds effacés automatiquement",
      "Arrière-plan flouté, rendu éditorial",
      "Formats 1:1, 4:5 et 9:16 automatiques",
      "Hashtags et alt text SEO générés",
    ],
    // VRAIE retouche Pictaura : les inconnus autour des deux sujets ont été
    // effacés et l'arrière-plan flouté — pas une simulation par filtre CSS.
    imageUrl: "/demo/social-avant.jpg",
    afterImageUrl: "/demo/social-apres.jpg",
    beforeFilter: "",
    afterFilter: "",
  },
  {
    segmentId: "ecommerce",
    name: "E-commerce",
    tagline: "Des fiches produit prêtes à publier",
    Icon: ShoppingBag,
    accent: "#09B884",
    presetLabel: "Presets Shopify & Vinted",
    bullets: [
      "Fond studio neutre et professionnel",
      "Couleurs et matières fidèles",
      "JSON-LD Product schema.org",
      "Alt text et nom SEO auto-générés",
    ],
    // VRAIE retouche Pictaura : un pull photographié à l'arrache devient une
    // photo studio — pas une simulation par filtre CSS.
    imageUrl: "/demo/ecommerce-avant.jpg",
    afterImageUrl: "/demo/ecommerce-apres.jpg",
    beforeFilter: "",
    afterFilter: "",
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
            afterImageUrl={d.afterImageUrl}
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
  interval,
}: {
  plan: (typeof PLANS)[number];
  featured: boolean;
  delay: number;
  interval: BillingInterval;
}) {
  const cents = getPriceEurCents(plan, interval);
  const annualSavings =
    interval === "year"
      ? Math.round((plan.monthlyPriceEurCents * 12 - plan.annualPriceEurCents) / 100)
      : 0;
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

        <div className="mb-1">
          <span
            className={`text-5xl font-display ${
              featured ? "text-sun" : "text-ink"
            }`}
          >
            {formatEur(cents)}
          </span>
          <span
            className={`text-sm ml-1 ${
              featured ? "text-cream/80" : "text-ink-muted"
            }`}
          >
            {interval === "year" ? "/an" : "/mois"}
          </span>
        </div>

        {interval === "year" && annualSavings > 0 && (
          <div
            className={`text-[11px] font-semibold mb-4 ${
              featured ? "text-sun" : "text-accent"
            }`}
          >
            Économisez {annualSavings}€/an
          </div>
        )}

        <div
          className={`text-sm font-bold mb-6 mt-4 ${
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
  const [pricingInterval, setPricingInterval] = useState<BillingInterval>("month");

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
              ["/agences", "Agences"],
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
              className={`text-sm font-bold transition-colors ${
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
              publier sur Shopify, Instagram ou une annonce immobilière en
              moins de 30 secondes par photo.
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
                "Résultat en moins de 30 secondes",
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
              {/* VRAIE retouche Pictaura (villa Var) : piscine verte assainie +
                  terrasse dégagée — pas une simulation par filtre CSS. */}
              <BeforeAfterHero
                imageUrl="/demo/villa-avant.jpg"
                afterImageUrl="/demo/villa-apres.jpg"
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
                &lt; 30 sec <Zap className="w-4 h-4 text-sun" />
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
              <DashboardCard key={d.segmentId} d={d} delay={i * 0.1} />
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
              les algorithmes référencent mieux vos photos sur toutes les plateformes.
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

            {/* Mockup EXIF — DONNÉES RÉELLES générées par Pictaura sur la
                photo villa du hero (Draguignan, Var), pas un exemple fictif. */}
            <FadeUp delay={0.15}>
              <SeoProofCard />
              <p className="text-center text-cream/60 text-xs mt-4">
                Donnée réelle générée par Pictaura sur la photo villa
                ci-dessus — rien n&apos;est simulé.
              </p>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── STATS / PREUVE ───────────────────────────────────── */}
      <section className="relative py-20 px-6">
        <div className="relative max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { Icon: Zap, value: "< 30 sec", label: "par photo, là où un shooting se compte en jours" },
              { Icon: ShoppingBag, value: "÷ 20", label: "vs le coût d'un photographe professionnel" },
              { Icon: Home, value: "30", label: "photos traitées en un seul lot, en parallèle" },
              { Icon: Sparkles, value: "100%", label: "des photos livrées avec le SEO gravé (EXIF + XMP)" },
            ].map((s, i) => (
              <FadeUp key={s.label} delay={i * 0.08}>
                <div className="h-full bg-white/95 backdrop-blur-sm border border-ink-soft rounded-3xl p-7 text-center shadow-[0_10px_30px_rgba(3,29,104,0.06)] hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(3,29,104,0.12)] transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <s.Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="font-display text-3xl md:text-4xl text-brand tracking-tight mb-2">
                    {s.value}
                  </div>
                  <p className="text-ink-muted text-xs leading-relaxed">
                    {s.label}
                  </p>
                </div>
              </FadeUp>
            ))}
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
          <FadeUp className="text-center mb-10 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border border-brand/25 bg-brand/10 text-brand mb-5">
              Tarifs transparents
            </span>
            <h2 className="text-display-lg font-display text-ink mb-4 leading-[1.05]">
              Choisissez votre plan,
              <br />
              <span className="gradient-text">payez ce que vous utilisez.</span>
            </h2>
            <p className="text-ink-muted leading-relaxed">
              {FREE_SIGNUP_CREDITS} retouches offertes à l&apos;inscription.
              Sans carte bancaire. Sans engagement. Résiliable en un clic.
            </p>
          </FadeUp>

          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-white border border-ink-soft rounded-full p-1 shadow-sm">
              <button
                onClick={() => setPricingInterval("month")}
                className={`px-5 py-2 text-xs font-semibold rounded-full transition-colors ${
                  pricingInterval === "month" ? "bg-ink text-cream" : "text-ink-muted"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setPricingInterval("year")}
                className={`px-5 py-2 text-xs font-semibold rounded-full transition-colors ${
                  pricingInterval === "year" ? "bg-ink text-cream" : "text-ink-muted"
                }`}
              >
                Annuel <span className="text-accent ml-1">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                featured={plan.highlighted ?? false}
                delay={i * 0.1}
                interval={pricingInterval}
              />
            ))}
          </div>

          {/* Pack one-shot */}
          <FadeUp delay={0.3}>
            <div className="mt-10 bg-white/95 rounded-3xl border border-ink-soft p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-[0_10px_30px_rgba(3,29,104,0.08)]">
              <div className="flex-1">
                <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-accent mb-2">
                  Pas prêt à vous abonner&nbsp;?
                </div>
                <div className="text-xl font-display text-ink mb-1">
                  {ONESHOT_PACK.name} — {formatEur(ONESHOT_PACK.priceEurCents)}
                </div>
                <div className="text-sm text-ink-muted">
                  Paiement unique. Les crédits ne s&apos;expirent pas. Idéal pour tester sans engagement.
                </div>
              </div>
              <Link
                href="/register"
                className="w-full md:w-auto md:min-w-[220px] text-center bg-ink text-cream py-3.5 px-6 rounded-xl font-bold text-sm hover:bg-brand transition-colors"
              >
                Créer un compte
              </Link>
            </div>
          </FadeUp>

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
                a: "Pictaura ne se contente pas de retoucher : il grave le SEO (alt text, nom de fichier sémantique, description, mots-clés, schema.org) directement dans le fichier. Les algorithmes référencent mieux vos photos sur toutes les plateformes.",
              },
              {
                q: "Comment fonctionnent les 3 plans ?",
                a: "Starter (14,90€/mois, 100 retouches), Pro (39,90€/mois, 400 retouches) ou Business (89,90€/mois, 1200 retouches). Tous les plans donnent accès à tous les presets (Immobilier, Réseaux sociaux, E-commerce) et à toutes les fonctionnalités. L'abonnement annuel offre -20%. Pas prêt à vous abonner ? Le pack 30 crédits à 9,90€ est sans engagement.",
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
                a: "JPEG, PNG, WEBP, HEIC et HEIF. Jusqu'à 50 Mo par photo — compatible avec les reflex professionnels. 30 photos maximum par lot, retouchées en parallèle : comptez moins de 30 secondes par photo.",
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
            Sans carte bancaire · Sans engagement · Résultat en moins de 30 secondes
          </p>
        </FadeUp>
      </section>

      <SiteFooter isHome />
    </div>
  );
}
