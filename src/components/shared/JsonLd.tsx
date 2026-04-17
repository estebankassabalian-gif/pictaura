const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.fr";

/**
 * JSON-LD SoftwareApplication — aide Google à comprendre que c'est un logiciel SaaS.
 * Apparaît dans les rich results Google.
 */
export function SoftwareApplicationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pictaura",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description:
      "Pictaura est un outil de retouche photo par intelligence artificielle pour les annonces Airbnb, les ventes Vinted, les posts Instagram et les boutiques Shopify. Optimisation automatique en 30 secondes.",
    url: APP_URL,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: "0",
      highPrice: "49.90",
      offerCount: "4",
      offers: [
        {
          "@type": "Offer",
          name: "Gratuit",
          price: "0",
          priceCurrency: "EUR",
          description: "5 crédits offerts à l'inscription",
        },
        {
          "@type": "Offer",
          name: "Immobilier",
          price: "49.90",
          priceCurrency: "EUR",
          description: "500 retouches/mois — annonces immobilières optimisées par IA",
        },
        {
          "@type": "Offer",
          name: "Réseaux sociaux",
          price: "49.90",
          priceCurrency: "EUR",
          description: "500 retouches/mois — contenus Instagram, TikTok, Stories",
        },
        {
          "@type": "Offer",
          name: "E-commerce",
          price: "49.90",
          priceCurrency: "EUR",
          description: "500 retouches/mois — photos produit Shopify, Vinted, Etsy",
        },
      ],
    },
    featureList: [
      "Optimisation photo Airbnb automatique",
      "Fond blanc automatique pour Vinted et Shopify",
      "Upscaling IA Real-ESRGAN",
      "Retouche sur instruction (inpainting IA)",
      "Score photo automatique /10",
      "Génération de métadonnées SEO",
      "Téléchargement image JPEG optimisée avec métadonnées SEO",
      "Compatible JPEG, PNG, WEBP, HEIC",
    ],
    screenshot: `${APP_URL}/og-image.jpg`,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "12",
      bestRating: "5",
      worstRating: "1",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * JSON-LD FAQ — apparaît directement dans les résultats Google (rich snippets).
 * Très efficace pour les mots-clés longue traîne.
 */
export function FaqJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Comment optimiser ses photos pour Airbnb ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pictaura optimise automatiquement vos photos Airbnb : redimensionnement à 1920×1280 pixels (ratio 3:2), amélioration de la luminosité et du contraste, upscaling IA pour une netteté maximale, et compression JPEG optimisée. En 30 secondes, vos photos sont prêtes à être publiées.",
        },
      },
      {
        "@type": "Question",
        name: "Comment mettre un fond blanc sur ses photos Vinted ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pictaura supprime automatiquement le fond de vos photos Vinted et le remplace par un fond blanc professionnel grâce à l'IA. Le produit est recadré et centré sur un fond blanc 1000×1000 pixels, idéal pour les marketplaces.",
        },
      },
      {
        "@type": "Question",
        name: "Pictaura est-il gratuit ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui, Pictaura offre 5 crédits gratuits à l'inscription, sans carte bancaire requise. 1 crédit = 1 photo traitée. Ensuite, des abonnements à 49,90€/mois (500 retouches) sont disponibles pour l'immobilier, les réseaux sociaux ou l'e-commerce.",
        },
      },
      {
        "@type": "Question",
        name: "Quelles plateformes sont supportées par Pictaura ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pictaura optimise les photos pour Airbnb et Booking.com (ratio 3:2, 1920×1280px), Instagram (carré 1:1 ou portrait 4:5), Vinted et autres marketplaces (fond blanc 1000×1000), et Shopify (fond blanc 2048×2048px).",
        },
      },
      {
        "@type": "Question",
        name: "Comment fonctionne la retouche sur instruction ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "La retouche sur instruction permet de modifier une photo en langage naturel. Par exemple : 'Retire le canapé rouge', 'Débâche la piscine', 'Nettoie les taches sur le vêtement'. Pictaura utilise l'IA générative pour exécuter la modification automatiquement en 30 à 60 secondes.",
        },
      },
      {
        "@type": "Question",
        name: "Les crédits Pictaura ont-ils une date d'expiration ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Non. Les crédits Pictaura n'expirent jamais. Vous pouvez les utiliser à votre rythme, sans pression.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * JSON-LD Organization — aide Google à identifier la marque.
 */
export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pictaura",
    url: APP_URL,
    logo: `${APP_URL}/logo.png`,
    description: "Outil de retouche photo IA pour Airbnb, Vinted, Instagram et Shopify.",
    sameAs: [
      "https://www.instagram.com/pictaura.fr",
      "https://www.tiktok.com/@pictaura.fr",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact@pictaura.fr",
      availableLanguage: "French",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
