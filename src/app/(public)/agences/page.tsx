import type { Metadata } from "next";
import AgencesClient from "@/components/landing/AgencesClient";

export const metadata: Metadata = {
  title: "Pictaura pour les agences immobilières — Retouche IA + SEO gravé",
  description:
    "Retouchez et référencez les photos de vos annonces en moins de 30 secondes. Testez sur vos propres biens, sans carte bancaire. SEO gravé dans chaque fichier.",
  alternates: { canonical: "/agences" },
  openGraph: {
    title: "Pictaura pour les agences immobilières",
    description:
      "Photos retouchées et référencées en moins de 30 secondes. Testez sur vos propres annonces, sans carte bancaire.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function AgencesPage() {
  return <AgencesClient />;
}
