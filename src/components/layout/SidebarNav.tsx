"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Camera,
  Store,
  Wand2,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Logo from "@/components/brand/Logo";

const ONBOARDING_KEY = "pictaura_onboarded";

type OnboardingOption = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  description: string;
};

const onboardingOptions: OnboardingOption[] = [
  {
    label: "Immobilier",
    href: "/immobilier",
    icon: Building2,
    color: "text-[#FF5A5F]",
    bg: "bg-[#FF5A5F]/10 border-[#FF5A5F]/25",
    description: "Annonces, Airbnb, locations",
  },
  {
    label: "Instagram",
    href: "/instagram",
    icon: Camera,
    color: "text-[#E1306C]",
    bg: "bg-[#E1306C]/10 border-[#E1306C]/25",
    description: "Contenus visuels et stories",
  },
  {
    label: "E-commerce",
    href: "/shopify",
    icon: Store,
    color: "text-[#09B884]",
    bg: "bg-[#09B884]/10 border-[#09B884]/25",
    description: "Shopify, Vinted, Etsy, marketplaces",
  },
];

function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setVisible(true);
      }
    } catch {
      /* localStorage bloqué */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch { /* ignore */ }
    setVisible(false);
  }

  function handleSelect(href: string) {
    dismiss();
    router.push(href);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,29,104,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-6 shadow-lg">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-xl bg-cream border border-ink/10 flex items-center justify-center mb-3">
            <Logo variant="mark" size={28} tone="ink" />
          </div>
          <h2 className="text-2xl font-display tracking-tight text-ink leading-tight">
            Quel est votre cas d&apos;usage ?
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Sélectionnez votre secteur pour démarrer avec les bons réglages.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {onboardingOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.href}
                onClick={() => handleSelect(option.href)}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl border ${option.bg} hover:scale-[1.02] transition-transform text-left`}
              >
                <Icon className={`w-5 h-5 ${option.color}`} />
                <span className={`text-sm font-bold ${option.color}`}>
                  {option.label}
                </span>
                <span className="text-xs text-ink-muted leading-snug">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={dismiss}
            className="text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Explorer d&apos;abord
          </button>
        </div>
      </div>
    </div>
  );
}

interface SidebarNavProps {
  userName: string;
  userEmail: string;
  userInitial: string;
  credits: number; // -1 = illimité (admin)
  isAdmin: boolean;
}

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const toolNav = [
  { href: "/immobilier", label: "Immobilier", icon: Building2 },
  { href: "/instagram", label: "Réseaux sociaux", icon: Camera },
  { href: "/shopify", label: "E-commerce", icon: Store },
];

const extraNav = [
  { href: "/editor", label: "Éditeur libre", icon: Wand2 },
];

const settingsNav = [
  { href: "/billing", label: "Crédits", icon: CreditCard },
  { href: "/account", label: "Compte", icon: Settings },
];

export function SidebarNav({ userName, userEmail, userInitial, credits, isAdmin }: SidebarNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-cream/10 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo variant="mark" size={28} tone="cream" />
          <span className="text-cream font-display tracking-tight">Pictaura</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-cream/70 hover:text-cream p-1"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <div className="!my-3 h-px bg-cream/10" />

        <div className="px-3 pb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cream/50">
            Outils experts
          </span>
        </div>
        {toolNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <div className="!my-3 h-px bg-cream/10" />

        {extraNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <div className="!my-3 h-px bg-cream/10" />

        {settingsNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {isAdmin && (
          <NavItem href="/admin" label="Admin" icon={Shield} active={pathname.startsWith("/admin")} />
        )}
      </nav>

      <div className="p-3 border-t border-cream/10">
        <div className="bg-accent/15 border border-accent/30 rounded-xl p-3 text-center mb-3">
          <div className="text-2xl font-display text-sun">
            {credits === -1 ? "\u221E" : credits}
          </div>
          <div className="text-[10px] text-cream/70 font-bold uppercase tracking-wider">
            crédits disponibles
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-sm px-1.5">
          <div className="w-8 h-8 bg-accent/20 border border-accent/40 rounded-full flex items-center justify-center text-xs font-bold text-sun flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-cream truncate text-sm">{userName}</div>
            <div className="text-[11px] text-cream/60 truncate">{userEmail}</div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 w-full flex items-center gap-2 text-xs text-cream/70 hover:text-cream text-left px-2 py-1.5 rounded-lg hover:bg-cream/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <>
      <OnboardingModal />

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-brand border-b border-brand-light/40 flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo variant="mark" size={24} tone="cream" />
          <span className="text-cream font-display tracking-tight text-sm">Pictaura</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-accent/15 border border-accent/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <span className="text-sm font-display text-sun">
              {credits === -1 ? "\u221E" : credits}
            </span>
            <span className="text-[9px] text-cream/60 font-bold uppercase">cr.</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="text-cream/80 hover:text-cream p-1"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-72 h-full bg-brand text-cream flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-brand text-cream border-r border-brand-light/40 flex-col flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
        active
          ? "bg-accent/20 text-sun"
          : "text-cream/75 hover:bg-cream/5 hover:text-cream"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent" aria-hidden="true" />
      )}
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  );
}
