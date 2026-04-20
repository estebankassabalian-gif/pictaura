import type { Metadata, Viewport } from "next";
import { Archivo_Black, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/Toaster";
import VoronoiBackground from "@/components/brand/VoronoiBackground";

const display = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});

const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.fr";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Pictaura — Des photos à la hauteur de votre vision",
    template: "%s | Pictaura",
  },
  description:
    "Pictaura retouche vos photos avec précision sans complexité technique. Interface pensée autour du regard et de l'intuition visuelle. Airbnb, Vinted, Instagram, Shopify — 5 crédits offerts à l'inscription.",
  keywords: [
    "retouche photo IA professionnelle",
    "photo immobilier IA",
    "optimisation photo e-commerce",
    "retouche photo batch",
    "SEO photo EXIF",
    "photo Shopify fond blanc",
    "retouche photo agence immobilière",
    "photo Vinted fond blanc",
    "retouche photo Instagram IA",
    "upscaling photo pro",
    "photo location courte durée",
    "améliorer qualité photo IA",
    "Pictaura",
  ],
  authors: [{ name: "Pictaura" }],
  creator: "Pictaura",
  publisher: "Pictaura",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: APP_URL,
    siteName: "Pictaura",
    title: "Pictaura — Des photos à la hauteur de votre vision",
    description:
      "La retouche photo simple mais experte, centrée sur le regard humain. En 1 à 2 minutes par photo, par l'IA. 5 crédits gratuits à l'inscription.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Pictaura — Retouche photo IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pictaura — Des photos à la hauteur de votre vision",
    description:
      "La retouche photo simple mais experte, centrée sur le regard humain. En 1 à 2 minutes par photo, par l'IA.",
    images: ["/og-image.svg"],
    creator: "@pictaura_fr",
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      "fr-FR": APP_URL,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  verification: {
    // google: "GOOGLE_SEARCH_CONSOLE_CODE",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFBF5" },
    { media: "(prefers-color-scheme: dark)", color: "#031D68" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${display.variable} ${sans.variable} font-sans text-ink isolate`}>
        {/* Dégradé global fixe — visible sur toutes les pages */}
        <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
          <VoronoiBackground intensity="subtle" />
        </div>
        <div className="relative z-0">
          <SessionProvider>
            <Toaster>{children}</Toaster>
          </SessionProvider>
        </div>
      </body>
    </html>
  );
}
