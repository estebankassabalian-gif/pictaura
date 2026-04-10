"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { PRO_PLAN, FREE_SIGNUP_CREDITS } from "@/config/plans";
import BeforeAfterHero from "@/components/landing/BeforeAfterHero";
import {
  Upload,
  Zap,
  Download,
  Microscope,
  Wand2,
  Pencil,
  Star,
  Search,
  Film,
  Gift,
  Check,
} from "lucide-react";

/* ── Fade-up animation variant ─────────────────────────────── */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE, delay },
  }),
};

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated counter ───────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Pictaura Logo SVG ─────────────────────────────────────── */
function PictauraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
      {/* Lens / aperture icon */}
      <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2" fill="none" opacity="0.9" />
      <circle cx="20" cy="20" r="5.5" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
      <circle cx="20" cy="20" r="2" fill="white" opacity="0.9" />
      {/* Sparkle */}
      <path d="M31 9l1 3 1-3 3 1-3 1 3 1-3-1-1 3-1-3-3 1 3-1-3-1z" fill="white" opacity="0.6" />
    </svg>
  );
}

/* ── Brand logos for marquee ──────────────────────────────── */
const BRAND_LOGOS = [
  { name: "Airbnb", color: "#FF5A5F", hasIcon: true, icon: (
    <svg height="22" viewBox="0 0 24 24" fill="#FF5A5F"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5c1.38 0 2.5 1.12 2.5 2.5S13.38 9.5 12 9.5 9.5 8.38 9.5 7 10.62 4.5 12 4.5zm5.25 10.5c0 2.9-2.35 5.25-5.25 5.25S6.75 17.9 6.75 15c0-2.1 1.35-3.9 3.25-4.75v-1c0-.55.45-1 1-1s1 .45 1 1v1c1.9.85 3.25 2.65 3.25 4.75z" /></svg>
  )},
  { name: "Instagram", color: "#E1306C", hasIcon: true, icon: (
    <svg height="22" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
  )},
  { name: "Shopify", color: "#96BF48", hasIcon: true, icon: (
    <svg height="22" viewBox="0 0 24 24" fill="#96BF48"><path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.035-.03-.066-.042-.098-.052l-.632 19.082zM11.831 7.997l-.688 2.305s-.761-.347-1.644-.347c-1.329 0-1.395.834-1.395 1.045.073 1.085 2.907 1.323 3.069 3.867.127 2.001-1.061 3.371-2.773 3.479-2.053.129-3.183-1.081-3.183-1.081l.435-1.851s1.136.852 2.043.803c.593-.033.805-.521.783-.862-.094-1.418-2.401-1.335-2.549-3.66-.125-1.956 1.162-3.942 4.004-4.12 1.092-.069 1.65.208 1.898.422zM12.276 3.449l-1.312.406C10.963 3.271 10.198 1 9.073 1 6.161 1 4.693 4.695 4.181 6.752l-2.365.732C.938 7.748.89 7.787.852 8.63L0 22.252l11.987 2.25.289-21.053z" /></svg>
  )},
  { name: "Vinted", color: "#09B884", hasIcon: false, icon: null },
  { name: "Booking.com", color: "#003580", hasIcon: false, icon: null },
  { name: "SeLoger", color: "#E00034", hasIcon: false, icon: null },
  { name: "CENTURY 21", color: "#B8860B", hasIcon: false, icon: null },
  { name: "leboncoin", color: "#F56B2A", hasIcon: false, icon: null },
  { name: "Etsy", color: "#F1641E", hasIcon: false, icon: null },
  { name: "Amazon", color: "#FF9900", hasIcon: false, icon: null },
  { name: "TikTok", color: "#00F2EA", hasIcon: false, icon: null },
  { name: "Pinterest", color: "#E60023", hasIcon: true, icon: (
    <svg height="22" viewBox="0 0 24 24" fill="#E60023"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" /></svg>
  )},
];

/* ── Infinite Marquee ─────────────────────────────────────── */
function BrandMarquee() {
  const allLogos = [...BRAND_LOGOS, ...BRAND_LOGOS];
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent 0, black 100px, black calc(100% - 100px), transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0, black 100px, black calc(100% - 100px), transparent 100%)",
      }}
    >
      <motion.div
        className="flex gap-14 items-center w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 35, ease: "linear", repeat: Infinity }}
      >
        {allLogos.map((brand, i) => (
          <div
            key={`${brand.name}-${i}`}
            className="flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-300 flex-shrink-0 cursor-default"
          >
            {brand.hasIcon && brand.icon}
            <span className="text-sm font-bold whitespace-nowrap tracking-tight" style={{ color: brand.color }}>{brand.name}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ── SVG logos (used in platform sections) ────────────────── */
function AirbnbLogo({ size = 28 }: { size?: number }) {
  return (
    <svg height={size} viewBox="0 0 24 24" fill="#FF5A5F">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5c1.38 0 2.5 1.12 2.5 2.5S13.38 9.5 12 9.5 9.5 8.38 9.5 7 10.62 4.5 12 4.5zm5.25 10.5c0 2.9-2.35 5.25-5.25 5.25S6.75 17.9 6.75 15c0-2.1 1.35-3.9 3.25-4.75v-1c0-.55.45-1 1-1s1 .45 1 1v1c1.9.85 3.25 2.65 3.25 4.75z" />
    </svg>
  );
}
function InstagramLogo({ size = 28 }: { size?: number }) {
  return (
    <svg height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ig2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" /><stop offset="50%" stopColor="#dc2743" /><stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig2)" />
      <rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" />
    </svg>
  );
}
function VintedLogo({ size = 28 }: { size?: number }) {
  return (
    <svg height={size} viewBox="0 0 90 32">
      <rect width="90" height="32" rx="6" fill="#09B884" />
      <text x="45" y="23" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="16" fill="white" letterSpacing="-0.5">vinted</text>
    </svg>
  );
}
function ShopifyLogo({ size = 28 }: { size?: number }) {
  return (
    <svg height={size} viewBox="0 0 50 56" fill="none">
      <path d="M42.5 10.5c0-.3-.3-.5-.5-.5-.2 0-4.5-.3-4.5-.3S34 6.3 33.5 5.8c-.5-.5-.9-.2-1.1-.1l-1.6.5C29.5 2.5 27.3 0 24.5 0c-.1 0-.2 0-.3 0-1-1.3-2.3-2-3.4-2C11 0 6.8 13.5 5.4 20.3L1 21.7c-1.5.5-1.6.5-1.7 2L-3 51.5 34 58l15-3.3L42.5 10.5z" fill="#96BF48"/>
      <path d="M41.5 10c-.2 0-4.5-.3-4.5-.3S33.5 6 33 5.5c-.2-.2-.5-.3-.7-.2V58l15-3.3L42 10.5c-.1-.3-.3-.5-.5-.5z" fill="#5E8E3E"/>
      <path d="M24.5 17.5l-2 6.2s-1.7-.9-3.7-.9c-3 .1-3 2-3 2.3.2 2.7 7.2 3.3 7.5 9.5.3 4.9-2.6 8.3-6.8 8.5-5 .3-7.9-2.7-7.9-2.7l1.1-4.5s2.8 2.1 5 2c1.5-.1 2-.9 2-1.7-.2-3.5-5.9-3.3-6.2-9-.3-4.8 2.8-9.6 9.8-10 2.7-.1 4 .6 4 .6z" fill="white"/>
    </svg>
  );
}

/* ── Platforms data ────────────────────────────────────────── */
const PLATFORMS = [
  {
    id: "immobilier", Logo: AirbnbLogo, name: "Immobilier & Location",
    badge: "Agences immobilières", accent: "#FF5A5F",
    specs: "1920 × 1280 px · Ratio 3:2",
    features: ["HDR adaptatif intérieur/extérieur", "Luminosité & balance des blancs pro", "Mise en scène virtuelle IA", "Ciel bleu & pelouse verts"],
    desc: "L'IA analyse chaque pièce, corrige l'éclairage, retire les éléments gênants et sublime le ciel. Vos annonces attirent 40% de visites supplémentaires.",
    imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80",
    beforeFilter: "grayscale(25%) brightness(0.72) contrast(0.82) saturate(0.5)",
    afterFilter: "brightness(1.18) saturate(1.3) contrast(1.1) hue-rotate(-2deg)",
  },
  {
    id: "instagram", Logo: InstagramLogo, name: "Instagram & Réseaux",
    badge: "Créateurs de contenu", accent: "#E1306C",
    specs: "Carré 1:1 · Portrait 4:5 · Stories 9:16",
    features: ["Filtre Cinematic Orange & Teal", "Skin retouching naturel IA", "Bokeh d'arrière-plan DSLR", "Reels MP4 Ken Burns 9:16"],
    desc: "Partez d'une photo brute et obtenez un rendu cinématographique : teintes Orange & Teal, skin smooth, bokeh naturel.",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&q=80",
    beforeFilter: "grayscale(35%) brightness(0.78) contrast(0.85) saturate(0.45)",
    afterFilter: "brightness(1.1) saturate(1.45) contrast(1.15) hue-rotate(-5deg)",
  },
  {
    id: "vinted", Logo: VintedLogo, name: "Vinted & Marketplace",
    badge: "Vente entre particuliers", accent: "#09B884",
    specs: "1000 × 1000 px · Fond blanc pur",
    features: ["Suppression fond automatique IA", "Fond blanc parfait #FFFFFF", "Ombre portée douce réaliste", "Auto-crop serré produit"],
    desc: "Isolez votre produit sur fond blanc professionnel en un clic. Vendez 3× plus vite.",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80",
    beforeFilter: "grayscale(20%) brightness(0.80) contrast(0.85) saturate(0.55)",
    afterFilter: "brightness(1.15) saturate(1.25) contrast(1.08)",
  },
  {
    id: "shopify", Logo: ShopifyLogo, name: "Shopify & E-commerce",
    badge: "Boutiques en ligne", accent: "#96BF48",
    specs: "2048 × 2048 px · Fond blanc #FFF",
    features: ["Fond blanc studio professionnel", "JSON-LD Product schema.org", "EXIF SEO gravé dans le fichier", "Packshot lifestyle IA"],
    desc: "Photos produit prêtes Shopify : fond blanc parfait, 2048px, alt text et nom SEO inscrits dans les métadonnées du fichier — pré-remplis à l'import.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80",
    beforeFilter: "grayscale(15%) brightness(0.76) contrast(0.83) saturate(0.5)",
    afterFilter: "brightness(1.16) saturate(1.22) contrast(1.1)",
  },
];

/* ── FAQ item ───────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left glass glass-hover rounded-2xl overflow-hidden transition-all"
    >
      <div className="flex items-center justify-between p-6 gap-4">
        <span className="font-semibold text-sm text-ink">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 w-5 h-5 text-ink-muted"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </motion.span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-ink-muted text-sm leading-relaxed px-6 pb-6 border-t border-white/5 pt-4">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function LandingClient() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="bg-[#08080c] text-ink selection:bg-brand-500/30 selection:text-white">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <motion.nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? "bg-[#08080c]/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PictauraLogo size={32} />
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold tracking-tight text-lg">Pictaura</span>
              <span className="text-[8px] text-ink-faint/50 font-medium tracking-wider uppercase">by GK Technologies</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["#plateformes", "Plateformes"], ["#comment", "Comment ça marche"], ["#pricing", "Tarifs"]].map(([h, l]) => (
              <a key={h} href={h} className="text-ink-muted hover:text-white text-sm font-medium transition-colors duration-200">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-ink-muted hover:text-white text-sm font-medium transition-colors hidden md:block">Connexion</Link>
            <Link href="/register" className="btn-primary text-sm py-2.5 px-5">
              Essai gratuit <span className="opacity-70">→</span>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-20">
        {/* Background effects */}
        <div className="absolute inset-0 grid-dots opacity-50 pointer-events-none" />
        <div className="absolute inset-0 spotlight pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/8 rounded-full blur-[120px] pointer-events-none" />

        <motion.div className="relative max-w-7xl mx-auto px-6 py-24 w-full" style={{ y: heroY }}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <div>
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                <span className="tag mb-8 block w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                  Le photographe pro de votre business · {FREE_SIGNUP_CREDITS} photos offertes
                </span>
              </motion.div>

              <motion.h1
                className="text-display-xl font-black tracking-[-0.04em] leading-[1.03] mb-6"
                variants={fadeUp} initial="hidden" animate="visible" custom={0.1}
              >
                <span className="gradient-text-white">Transformez vos photos</span>
                <br />
                <span className="text-brand-400">en aimants à clients</span>
                <br />
                <span className="gradient-text-white">— en 30 secondes.</span>
              </motion.h1>

              <motion.p
                className="text-ink-muted text-base leading-relaxed max-w-md mb-6"
                variants={fadeUp} initial="hidden" animate="visible" custom={0.2}
              >
                Vos biens, produits et créations paraissent enfin à la hauteur de leur vraie valeur.
                Sans photographe à 200€/bien. Sans Photoshop. Sans y passer la journée.
              </motion.p>

              <motion.div
                className="max-w-md mb-10 bg-white/[0.03] border border-white/8 rounded-xl p-4"
                variants={fadeUp} initial="hidden" animate="visible" custom={0.25}
              >
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-black text-brand-400"><Counter to={61} suffix="%" /></div>
                    <div className="text-[10px] text-ink-muted font-medium leading-tight mt-1">de vues en plus sur vos annonces<sup>*</sup></div>
                  </div>
                  <div className="border-x border-white/8">
                    <div className="text-2xl font-black text-brand-400"><Counter to={32} suffix="%" /></div>
                    <div className="text-[10px] text-ink-muted font-medium leading-tight mt-1">plus rapide pour vendre un bien<sup>*</sup></div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-brand-400"><Counter to={40} suffix="%" /></div>
                    <div className="text-[10px] text-ink-muted font-medium leading-tight mt-1">de réservations Airbnb<sup>*</sup></div>
                  </div>
                </div>
                <p className="text-[9px] text-ink-muted/60 mt-3 text-center">* Sources : Redfin, Airbnb — études sur l&apos;impact des photos professionnelles</p>
              </motion.div>

              <motion.div
                className="flex gap-3 flex-wrap mb-10"
                variants={fadeUp} initial="hidden" animate="visible" custom={0.3}
              >
                <Link href="/register" className="btn-primary">
                  Essayer gratuitement — {FREE_SIGNUP_CREDITS} photos offertes
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <a href="#comment" className="btn-outline">Voir comment ça marche</a>
              </motion.div>

              <motion.div
                className="flex flex-wrap gap-5"
                variants={fadeUp} initial="hidden" animate="visible" custom={0.4}
              >
                {["Optimisé Airbnb · SeLoger · Instagram · Shopify", "Sans carte bancaire", "Résultat en 30 secondes", "Paiement Stripe sécurisé"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-ink-muted font-medium">
                    <svg className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right — before/after */}
            <motion.div
              className="relative h-[480px]"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            >
              {/* Glow behind */}
              <div className="absolute inset-0 bg-brand-600/10 rounded-3xl blur-2xl scale-95 pointer-events-none" />

              {/* Frame */}
              <div className="relative h-full rounded-2xl overflow-hidden border border-white/8 shadow-[0_0_80px_rgba(139,92,246,0.15)]">
                <BeforeAfterHero
                  imageUrl="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80"
                  beforeFilter="grayscale(25%) brightness(0.72) contrast(0.82) saturate(0.5)"
                  afterFilter="brightness(1.18) saturate(1.3) contrast(1.1)"
                />
              </div>

              {/* Float badge top-left */}
              <motion.div
                className="absolute -top-4 -left-4 glass rounded-xl px-4 py-3 flex items-center gap-2.5 z-10 border border-white/8"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="text-[10px] font-bold text-white">Après Pictaura</div>
                  <div className="text-[10px] text-emerald-400 font-semibold">+40% réservations</div>
                </div>
              </motion.div>

              {/* Float badge bottom-right */}
              <motion.div
                className="absolute -bottom-4 -right-4 bg-brand-600 rounded-xl px-4 py-3 z-10 border border-brand-400/30"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              >
                <div className="text-[10px] text-brand-200 font-semibold">Traitement IA</div>
                <div className="text-base font-black text-white flex items-center gap-1">~30 sec <Zap className="w-4 h-4 text-yellow-400" /></div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <span className="text-[10px] text-ink-faint tracking-widest uppercase">Scroll</span>
          <motion.div
            className="w-px h-8 bg-gradient-to-b from-brand-500/60 to-transparent"
            animate={{ scaleY: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </section>

      {/* ── LOGOS MARQUEE ────────────────────────────────────────── */}
      <div className="line-fade" />
      <section className="py-14 overflow-hidden">
        <p className="text-center text-[10px] font-bold text-ink-faint uppercase tracking-[0.2em] mb-10">Compatible avec vos plateformes préférées</p>
        <BrandMarquee />
      </section>
      <div className="line-fade" />

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: 30, suffix: "s", label: "De traitement" },
            { value: 4, suffix: "", label: "Plateformes" },
            { value: 10, suffix: "", label: "Photos par lot" },
            { value: FREE_SIGNUP_CREDITS, suffix: "", label: "Crédits offerts" },
          ].map((s, i) => (
            <FadeUp key={s.label} delay={i * 0.1} className="text-center">
              <div className="text-display-md font-black gradient-text mb-1">
                <Counter to={Number(s.value)} suffix={s.suffix} />
              </div>
              <div className="text-xs text-ink-muted font-medium uppercase tracking-wider">{s.label}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── PLATFORMS ──────────────────────────────────────────── */}
      <section id="plateformes" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-24">
            <span className="tag mb-5 block w-fit mx-auto">Spécialisé par secteur</span>
            <h2 className="text-display-lg font-black gradient-text-white mb-4">
              Le bon traitement pour<br />chaque plateforme
            </h2>
            <p className="text-ink-muted max-w-xl mx-auto">Chaque réseau a ses propres exigences. Pictaura applique automatiquement les bons paramètres.</p>
          </FadeUp>

          <div className="space-y-32">
            {PLATFORMS.map((p, i) => (
              <FadeUp key={p.id} delay={0.1}>
                <article className={`grid lg:grid-cols-2 gap-16 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
                  {/* Text */}
                  <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                    <div className="flex items-center gap-3 mb-6">
                      <p.Logo size={28} />
                      <span className="text-xs font-bold px-3 py-1 rounded-full border"
                        style={{ color: p.accent, borderColor: `${p.accent}30`, background: `${p.accent}10` }}>
                        {p.badge}
                      </span>
                    </div>

                    <h3 className="text-display-md font-black text-white mb-3">{p.name}</h3>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted bg-white/4 px-3 py-1.5 rounded-lg border border-white/5 w-fit mb-5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      {p.specs}
                    </div>

                    <p className="text-ink-muted text-sm leading-relaxed mb-7">{p.desc}</p>

                    <ul className="space-y-3 mb-8">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-sm text-ink">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            style={{ color: p.accent }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link href="/register" className="btn-primary inline-flex" style={{ background: p.accent }}>
                      Essayer ce preset <span className="opacity-70">→</span>
                    </Link>
                  </div>

                  {/* Slider */}
                  <div className={`relative h-[420px] ${i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}`}>
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at center, ${p.accent}, transparent 70%)` }} />
                    <div className="relative h-full rounded-2xl overflow-hidden border border-white/8"
                      style={{ boxShadow: `0 0 60px ${p.accent}20` }}>
                      <BeforeAfterHero imageUrl={p.imageUrl} beforeFilter={p.beforeFilter} afterFilter={p.afterFilter} />
                    </div>
                  </div>
                </article>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="comment" className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-20">
            <span className="tag mb-5 block w-fit mx-auto">Simple & rapide</span>
            <h2 className="text-display-lg font-black gradient-text-white mb-4">Comment ça marche ?</h2>
            <p className="text-ink-muted">3 étapes, 30 secondes, résultat professionnel.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent pointer-events-none" />

            {[
              { step: "01", Icon: Upload, title: "Uploadez vos photos", desc: "Jusqu'à 10 photos. JPEG, PNG, WEBP, HEIC. Jusqu'à 20 Mo par photo. Drag & drop.", badge: "Analyse qualité auto" },
              { step: "02", Icon: Zap, title: "L'IA retouche en 30s", desc: "Optimisation, recadrage, couleurs, fond blanc, SEO — tout en parallèle.", badge: "IA Pictaura" },
              { step: "03", Icon: Download, title: "Téléchargez votre pack", desc: "ZIP avec photos retouchées + métadonnées SEO gravées dans chaque fichier. Importez sur Shopify ou WordPress : alt texts et noms pré-remplis automatiquement.", badge: "ZIP + EXIF + CSV SEO" },
            ].map((item, i) => (
              <FadeUp key={item.step} delay={i * 0.15}>
                <div className="glass glass-hover rounded-3xl p-8 relative group">
                  {/* Step number */}
                  <div className="absolute top-6 right-6 text-6xl font-black text-white/3 select-none leading-none">{item.step}</div>

                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6 group-hover:border-brand-500/40 transition-colors">
                    <item.Icon className="w-5 h-5 text-brand-400" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed mb-5">{item.desc}</p>
                  <span className="text-[10px] text-brand-400 font-mono bg-brand-500/8 border border-brand-500/15 px-3 py-1.5 rounded-lg">
                    {item.badge}
                  </span>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <span className="tag mb-5 block w-fit mx-auto">Fonctionnalités</span>
            <h2 className="text-display-lg font-black gradient-text-white mb-4">
              Bien plus qu&apos;un<br />outil de retouche
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { Icon: Microscope, title: "Upscaling IA", desc: "Real-ESRGAN multiplie la résolution. Vos photos floues deviennent nettes sans artefacts.", accent: "from-blue-500 to-cyan-500" },
              { Icon: Wand2, title: "Fond blanc auto", desc: "L'IA détecte et supprime le fond pour du blanc parfait. Sans Photoshop.", accent: "from-brand-500 to-violet-500" },
              { Icon: Pencil, title: "Retouche sur instruction", desc: '"Retire le canapé", "Débâche la piscine" — Pictaura exécute en 60s.', accent: "from-orange-500 to-amber-500" },
              { Icon: Star, title: "Score photo /10", desc: "Pictaura analyse luminosité, cadrage, attractivité. Rapport détaillé inclus.", accent: "from-yellow-500 to-orange-500" },
              { Icon: Search, title: "SEO gravé dans l'image", desc: "Alt text, nom SEO et mots-clés écrits directement dans les métadonnées EXIF du fichier. Shopify et WordPress les lisent automatiquement à l'import — zéro saisie manuelle.", accent: "from-emerald-500 to-teal-500" },
              { Icon: Film, title: "Reels MP4 Ken Burns", desc: "Photo → vidéo 9:16 animée. 3-5× plus de reach qu'une photo statique.", accent: "from-pink-500 to-rose-500" },
            ].map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.08}>
                <article className="glass glass-hover rounded-2xl p-7 group h-full">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <f.Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{f.desc}</p>
                </article>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ───────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeUp className="text-center mb-12">
            <h2 className="text-display-md font-black gradient-text-white mb-3">Pictaura vs les alternatives</h2>
            <p className="text-ink-muted text-sm">Pourquoi Pictaura plutôt que Lightroom ou un photographe ?</p>
          </FadeUp>

          <FadeUp>
            <div className="glass rounded-3xl overflow-hidden border border-white/7">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-6 py-5 text-ink-muted font-medium">Fonctionnalité</th>
                    <th className="px-6 py-5 text-center bg-brand-500/5 border-b border-brand-500/10">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center shadow-glow-sm">
                          <span className="text-white font-black text-xs">P</span>
                        </div>
                        <span className="font-bold text-brand-400 text-[10px] uppercase tracking-wide">Pictaura</span>
                      </div>
                    </th>
                    <th className="px-6 py-5 text-center text-ink-muted font-medium text-[11px]">Lightroom</th>
                    <th className="px-6 py-5 text-center text-ink-muted font-medium text-[11px]">Photographe</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Résultat en 30 secondes", true, false, false],
                    ["Spécialisé Airbnb / Vinted / Instagram", true, false, false],
                    ["Fond blanc automatique IA", true, false, true],
                    ["SEO gravé dans le fichier (EXIF + JSON-LD)", true, false, false],
                    ["Score photo IA + rapport", true, false, false],
                    ["Prix < 0,25€ par photo", true, false, false],
                    ["Aucune compétence requise", true, false, true],
                  ].map(([feat, p, lr, ph], idx) => (
                    <tr key={String(feat)} className={`border-t border-white/4 hover:bg-white/2 transition-colors ${idx % 2 === 0 ? "" : "bg-white/1"}`}>
                      <td className="px-6 py-4 text-ink-muted">{feat}</td>
                      <td className="px-6 py-4 text-center bg-brand-500/3">
                        {p ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {lr ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {ph ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-ink-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section id="pricing" className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <span className="tag mb-5 block w-fit mx-auto">Tarif unique</span>
            <h2 className="text-display-lg font-black gradient-text-white mb-4">Un seul plan, tout inclus</h2>
            <p className="text-ink-muted">{FREE_SIGNUP_CREDITS} crédits offerts à l&apos;inscription pour tester. Puis un abonnement Pro tout-en-un.</p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free trial */}
            <FadeUp>
              <div className="glass rounded-3xl p-8 text-center border border-white/8">
                <Gift className="w-8 h-8 text-brand-400 mx-auto mb-3" />
                <h3 className="font-black text-white mb-2 text-lg">Essai gratuit</h3>
                <div className="text-5xl font-black gradient-text my-4">{FREE_SIGNUP_CREDITS}</div>
                <div className="text-brand-300 font-bold mb-1">photos offertes</div>
                <p className="text-xs text-ink-muted mb-8">Sans carte bancaire · Immédiatement</p>
                <Link
                  href="/register"
                  className="block w-full py-3.5 rounded-xl font-bold text-sm bg-white/5 text-ink hover:bg-white/10 border border-white/8 transition-all"
                >
                  Essayer gratuitement
                </Link>
              </div>
            </FadeUp>

            {/* Pro plan */}
            <FadeUp delay={0.1}>
              <div className="glass glass-hover rounded-3xl p-8 text-center relative border-brand-500/40 shadow-glow-md transition-all hover:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-glow-sm">
                  RECOMMANDÉ
                </div>
                <h3 className="text-base font-bold text-white mb-3 mt-2">{PRO_PLAN.name}</h3>
                <div className="text-5xl font-black gradient-text-white my-4">{PRO_PLAN.priceDisplay}</div>
                <div className="text-xl font-bold text-brand-400 mb-1">{PRO_PLAN.creditsPerMonth} photos/mois</div>
                <div className="text-xs text-ink-muted mb-4">{PRO_PLAN.pricePerPhoto}/photo</div>
                <ul className="text-left space-y-2 mb-8 text-sm text-zinc-300 max-w-xs mx-auto">
                  {PRO_PLAN.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 text-white hover:bg-brand-600 shadow-glow-sm hover:shadow-glow-md transition-all"
                >
                  Commencer
                </Link>
              </div>
            </FadeUp>
          </div>
          <p className="text-center text-xs text-ink-faint mt-8">Résiliable à tout moment · Remboursement automatique si échec de traitement</p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section id="faq" className="py-28">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp className="text-center mb-12">
            <span className="tag mb-5 block w-fit mx-auto">FAQ</span>
            <h2 className="text-display-md font-black gradient-text-white">Questions fréquentes</h2>
          </FadeUp>

          <div className="space-y-3">
            {[
              { q: "Comment optimiser ses photos pour Airbnb avec Pictaura ?", a: "Inscrivez-vous, uploadez vos photos et sélectionnez le preset Airbnb. Pictaura redimensionne à 1920×1280px, améliore la luminosité, le contraste, et applique l'upscaling IA Real-ESRGAN. Téléchargez le ZIP en un clic." },
              { q: "Comment mettre un fond blanc sur ses photos Vinted ?", a: "Sélectionnez le preset Vinted. Pictaura détecte et supprime automatiquement le fond, puis place votre produit sur fond blanc parfait 1000×1000px avec une ombre douce." },
              { q: "Comment fonctionne l'abonnement Pro ?", a: "29€/mois pour 200 photos optimisées. Les crédits non utilisés ne sont pas reportés. Résiliable à tout moment depuis votre espace. 5 photos offertes à l'inscription pour tester." },
              { q: "Qu'est-ce que la retouche sur instruction ?", a: 'Après traitement, écrivez ce que vous voulez modifier : "Retire le canapé rouge", "Débâche la piscine". Pictaura exécute la modification en 60s. Coût : 1 crédit.' },
              { q: "Quels formats sont acceptés ?", a: "JPEG, PNG, WEBP et HEIC (iPhone). Taille maximale 20 Mo par photo, jusqu'à 10 photos par lot." },
              { q: "Qu'est-ce qu'un Reel Ken Burns ?", a: "Pictaura transforme votre photo en vidéo MP4 9:16 animée avec un léger zoom ou panoramique. Les Reels ont 3-5× plus de reach que les photos statiques sur Instagram." },
            ].map((item) => (
              <FadeUp key={item.q} delay={0.05}>
                <FaqItem q={item.q} a={item.a} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────── */}
      <section className="relative py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-brand-950/30 to-[#050505] pointer-events-none" />
        <div className="absolute inset-0 grid-dots opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand-600/12 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />

        <FadeUp className="relative max-w-2xl mx-auto text-center">
          <span className="tag mb-8 block w-fit mx-auto">Prêt à commencer</span>
          <h2 className="text-display-xl font-black gradient-text mb-6">
            Sublimez vos<br />photos maintenant.
          </h2>
          <p className="text-ink-muted mb-12 leading-relaxed">
            Rejoignez des propriétaires Airbnb, vendeurs Vinted et créateurs Instagram qui gagnent du temps avec Pictaura.
          </p>
          <Link href="/register" className="btn-primary text-base py-5 px-10 shadow-glow-lg inline-flex">
            Commencer gratuitement — {FREE_SIGNUP_CREDITS} crédits offerts
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-ink-faint text-xs mt-6">Sans carte bancaire · Sans engagement · Résultat en 30 secondes</p>
        </FadeUp>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-glow-sm">
                  <span className="text-white font-black text-sm">P</span>
                </div>
                <span className="text-white font-bold tracking-tight">Pictaura</span>
              </div>
              <p className="text-ink-muted text-sm max-w-xs leading-relaxed">Retouche photo IA pour Airbnb, Vinted, Instagram et Shopify. Résultat pro en 30 secondes.</p>
              <p className="text-xs mt-4 text-ink-faint">Propulsé par l'IA Pictaura</p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-sm">
              <div>
                <h3 className="font-bold text-ink text-[10px] uppercase tracking-[0.15em] mb-4">Produit</h3>
                <ul className="space-y-3 text-ink-muted">
                  {[["#plateformes", "Plateformes"], ["#comment", "Comment ça marche"], ["#pricing", "Tarifs"], ["#faq", "FAQ"]].map(([h, l]) => (
                    <li key={h}><a href={h} className="hover:text-white transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-ink text-[10px] uppercase tracking-[0.15em] mb-4">Légal</h3>
                <ul className="space-y-3 text-ink-muted">
                  <li><Link href="/cgu" className="hover:text-white transition-colors">CGU</Link></li>
                  <li><Link href="/politique-confidentialite" className="hover:text-white transition-colors">Confidentialité</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="line-fade mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-ink-faint">© {new Date().getFullYear()} Pictaura — Tous droits réservés</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Paiement sécurisé SSL · Stripe
              </div>
              <span className="text-[10px] text-ink-faint/50">Created by GK Technologies</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
