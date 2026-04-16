import Link from "next/link";
import type { ReactNode } from "react";
import VoronoiBackground from "@/components/brand/VoronoiBackground";
import Logo from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink lg:grid lg:grid-cols-2">
      {/* Panneau gauche — voronoï + pitch */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-cream">
        <VoronoiBackground intensity="hero" />
        <div className="absolute inset-0 bg-brand/30" aria-hidden="true" />
        <div className="relative z-10">
          <Link href="/" aria-label="Retour à l'accueil Pictaura">
            <Logo variant="horizontal" tone="cream" size={44} />
          </Link>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl xl:text-5xl font-display tracking-tight leading-[1.05]">
            Des photos à la hauteur de votre vision.
          </h2>
          <p className="text-base xl:text-lg text-cream/85 max-w-md leading-relaxed">
            La retouche photo simple mais experte, centrée sur le regard humain — en 30 secondes, par l'IA.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <span className="h-1.5 w-12 rounded-full bg-sun" />
            <span className="h-1.5 w-6 rounded-full bg-accent" />
            <span className="h-1.5 w-3 rounded-full bg-cream/60" />
          </div>
        </div>
        <div className="relative z-10 text-xs text-cream/70 tracking-wide uppercase">
          © {new Date().getFullYear()} Pictaura · Retouche IA pro
        </div>
      </aside>

      {/* Panneau droit — form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden justify-center mb-8">
            <Link href="/" aria-label="Retour à l'accueil Pictaura">
              <Logo variant="horizontal" tone="ink" size={40} />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
