import type { Metadata } from "next";
import { SoftwareApplicationJsonLd, FaqJsonLd, OrganizationJsonLd } from "@/components/shared/JsonLd";
import LandingClient from "@/components/landing/LandingClient";

export const metadata: Metadata = {
  title: "Pictaura — Retouche photo IA pour Airbnb, Vinted, Instagram & Shopify",
  description: "Optimisez vos photos Airbnb, Vinted, Instagram et Shopify en 30 secondes. Upscaling IA, fond blanc automatique, SEO des images. 5 crédits gratuits, sans engagement.",
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
