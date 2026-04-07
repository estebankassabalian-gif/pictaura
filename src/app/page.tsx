import type { Metadata } from "next";
import { SoftwareApplicationJsonLd, FaqJsonLd, OrganizationJsonLd } from "@/components/shared/JsonLd";
import LandingClient from "@/components/landing/LandingClient";

export const metadata: Metadata = {
  title: "Pictaura — Retouche photo IA professionnelle | Immobilier, E-commerce, Réseaux sociaux",
  description: "Optimisez automatiquement vos photos pro en 30 secondes. Retouche IA, upscaling, fond blanc, métadonnées SEO. 200 photos/mois à 29€. Essai gratuit.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <SoftwareApplicationJsonLd />
      <FaqJsonLd />
      <OrganizationJsonLd />
      <LandingClient />
    </>
  );
}
