import type { Metadata } from "next";
import { SoftwareApplicationJsonLd, FaqJsonLd, OrganizationJsonLd } from "@/components/shared/JsonLd";
import LandingClient from "@/components/landing/LandingClient";

export const metadata: Metadata = {
  title: "Pictaura — Le photographe pro IA pour votre business | Immobilier, E-commerce, Réseaux",
  description: "Transformez vos photos en aimants à clients en moins de 30 secondes par photo. Jusqu'à +61% de vues sur vos annonces, +40% de réservations Airbnb. 5 photos offertes sans CB.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Pictaura — Le photographe pro IA pour votre business",
    description: "Vos photos à la hauteur de votre vraie valeur. +61% de vues, +40% de réservations. 5 photos offertes.",
    type: "website",
    locale: "fr_FR",
  },
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
