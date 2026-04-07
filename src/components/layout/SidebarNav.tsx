"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Camera,
  ShoppingBag,
  Store,
  Wand2,
  Film,
  CreditCard,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";

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
    bg: "bg-[#FF5A5F]/10 border-[#FF5A5F]/20",
    description: "Annonces, Airbnb, locations",
  },
  {
    label: "Instagram",
    href: "/instagram",
    icon: Camera,
    color: "text-[#E1306C]",
    bg: "bg-[#E1306C]/10 border-[#E1306C]/20",
    description: "Contenus visuels et stories",
  },
  {
    label: "Vinted",
    href: "/vinted",
    icon: ShoppingBag,
    color: "text-[#09B884]",
    bg: "bg-[#09B884]/10 border-[#09B884]/20",
    description: "Seconde main et marketplace",
  },
  {
    label: "E-commerce",
    href: "/shopify",
    icon: Store,
    color: "text-[#96BF48]",
    bg: "bg-[#96BF48]/10 border-[#96BF48]/20",
    description: "Boutique Shopify et produits",
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
      // localStorage peut être bloqué (SSR ou mode privé strict)
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
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6"
        style={{ background: "#0f0f1a" }}
      >
        {/* Title */}
        <div className="mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3">
            <span className="text-white font-black text-sm">P</span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            Quel est votre cas d&apos;usage ?
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Selectionnez votre secteur pour commencer avec les bons reglages.
          </p>
        </div>

        {/* Options */}
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
                <span className={`text-sm font-semibold ${option.color}`}>
                  {option.label}
                </span>
                <span className="text-xs text-zinc-500 leading-snug">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explore link */}
        <div className="text-center">
          <button
            onClick={dismiss}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
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
  credits: number; // -1 means unlimited (admin)
  isAdmin: boolean;
}

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const toolNav = [
  { href: "/immobilier", label: "Immobilier", icon: Building2, color: "text-[#FF5A5F]", bg: "bg-[#FF5A5F]/10" },
  { href: "/instagram", label: "Instagram", icon: Camera, color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" },
  { href: "/vinted", label: "Vinted", icon: ShoppingBag, color: "text-[#09B884]", bg: "bg-[#09B884]/10" },
  { href: "/shopify", label: "E-commerce", icon: Store, color: "text-[#96BF48]", bg: "bg-[#96BF48]/10" },
];

const extraNav = [
  { href: "/editor", label: "Editeur libre", icon: Wand2 },
  { href: "/reel", label: "Reels", icon: Film },
];

const settingsNav = [
  { href: "/billing", label: "Credits", icon: CreditCard },
  { href: "/account", label: "Compte", icon: Settings },
];

export function SidebarNav({ userName, userEmail, userInitial, credits, isAdmin }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <>
      <OnboardingModal />
      <aside className="w-60 bg-[var(--surface)] border-r border-white/5 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-white font-black text-xs">P</span>
          </div>
          <span className="text-white font-bold tracking-tight">Pictaura</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Main */}
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Separator */}
        <div className="!my-3 h-px bg-white/5" />

        {/* 4 Expert Tools */}
        <div className="px-3 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Outils experts
          </span>
        </div>
        {toolNav.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} activeColor={item.color} activeBg={item.bg} />
        ))}

        {/* Separator */}
        <div className="!my-3 h-px bg-white/5" />

        {/* Extra tools */}
        {extraNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Separator */}
        <div className="!my-3 h-px bg-white/5" />

        {/* Settings */}
        {settingsNav.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {isAdmin && (
          <NavItem href="/admin" label="Admin" icon={Shield} active={pathname.startsWith("/admin")} />
        )}
      </nav>

      {/* Footer: credits + user */}
      <div className="p-3 border-t border-white/5">
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center mb-3">
          <div className="text-2xl font-black text-violet-400">
            {credits === -1 ? "\u221E" : credits}
          </div>
          <div className="text-[10px] text-violet-300/70 font-semibold uppercase tracking-wider">
            crédits disponibles
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-sm px-1.5">
          <div className="w-8 h-8 bg-violet-500/15 border border-violet-500/20 rounded-full flex items-center justify-center text-xs font-bold text-violet-400 flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate text-sm">{userName}</div>
            <div className="text-[11px] text-[var(--muted)] truncate">{userEmail}</div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 w-full flex items-center gap-2 text-xs text-[var(--muted)] hover:text-white text-left px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Deconnexion
        </button>
      </div>
    </aside>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  activeColor,
  activeBg,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  activeColor?: string;
  activeBg?: string;
}) {
  const activeClasses = activeColor && activeBg
    ? `${activeBg} ${activeColor}`
    : "bg-violet-500/10 text-violet-400";

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
        active
          ? activeClasses
          : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  );
}
