import type { Metadata } from "next";
import { Bricolage_Grotesque, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/Toaster";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    default: "Pictaura — Retouche photo IA pour professionnels",
    template: "%s | Pictaura",
  },
  description:
    "Des photos à la hauteur de votre vision. Retouche IA pro pour agences immobilières, e-commerçants et studios : batch, SEO EXIF intégré, sans watermark. 5 crédits offerts à l'inscription.",
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
      <body className={`${display.variable} ${sans.variable} font-sans`}>
        <SessionProvider>
          <Toaster>{children}</Toaster>
        </SessionProvider>
      </body>
    </html>
  );
}
