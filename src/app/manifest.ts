import type { MetadataRoute } from "next";

/**
 * Convention native Next.js — remplace l'ancien public/site.webmanifest
 * statique. Servi automatiquement (Next injecte le <link rel="manifest">),
 * pas besoin de le référencer manuellement dans metadata.
 *
 * start_url pointe direct sur /dashboard : middleware.ts protège déjà cette
 * route (redirection /login automatique si non connecté), donc aucun risque
 * à cibler directement le produit plutôt que la landing marketing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pictaura — Des photos à la hauteur de votre vision",
    short_name: "Pictaura",
    description:
      "La retouche photo simple mais experte, centrée sur le regard humain. Airbnb, Vinted, Instagram, Shopify — en 30 secondes par l'IA.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFBF5",
    theme_color: "#F87005",
    lang: "fr",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/android-chrome-192x192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/android-chrome-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
