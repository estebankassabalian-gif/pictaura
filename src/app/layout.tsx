import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.fr";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Pictaura — Retouche photo IA pour Airbnb, Vinted & Instagram",
    template: "%s | Pictaura",
  },
  description:
    "Optimisez vos photos Airbnb, Vinted, Instagram et Shopify en 30 secondes grâce à l'IA. Upscaling, fond blanc automatique, SEO des images, score photo. Téléchargez votre pack optimisé instantanément.",
  keywords: [
    "retouche photo IA",
    "optimisation photo Airbnb",
    "photo Vinted fond blanc",
    "améliorer photos location saisonnière",
    "retouche photo Instagram IA",
    "photo Shopify fond blanc",
    "optimiser photos Airbnb automatique",
    "retouche photo automatique",
    "IA retouche photo",
    "photo location courte durée",
    "upscaling photo",
    "améliorer qualité photo",
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
    title: "Pictaura — Retouche photo IA pour Airbnb, Vinted & Instagram",
    description:
      "Vos photos optimisées en 30 secondes par l'IA. Airbnb, Vinted, Instagram, Shopify. 5 crédits gratuits à l'inscription.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Pictaura — Retouche photo IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pictaura — Retouche photo IA",
    description:
      "Vos photos Airbnb, Vinted & Instagram optimisées en 30 secondes par l'IA.",
    images: ["/og-image.jpg"],
    creator: "@pictaura_fr",
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      "fr-FR": APP_URL,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/site.webmanifest",
  verification: {
    // google: "GOOGLE_SEARCH_CONSOLE_CODE", // À remplir après vérification Google Search Console
  },
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
      <body className={inter.className}>
        <SessionProvider>
          <Toaster>{children}</Toaster>
        </SessionProvider>
      </body>
    </html>
  );
}
