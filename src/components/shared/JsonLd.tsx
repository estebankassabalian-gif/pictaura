import { PLANS, ONESHOT_PACK, FREE_SIGNUP_CREDITS, formatEur } from "@/config/plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.app";
// PLANS[0]=Starter, [1]=Pro, [2]=Business — mêmes indices que la grille tarifaire.
const [STARTER, PRO, BUSINESS] = PLANS;

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
      "Pictaura est un outil de retouche photo par intelligence artificielle pour les annonces Airbnb, les ventes Vinted, les posts Instagram et les boutiques Shopify. Optimisation automatique en moins de 30 secondes par photo.",
    url: APP_URL,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: "0",
      highPrice: (BUSINESS.monthlyPriceEurCents / 100).toFixed(2),
      offerCount: "5",
      offers: [
        {
          "@type": "Offer",
          name: "Gratuit",
          price: "0",
          priceCurrency: "EUR",
          description: `${FREE_SIGNUP_CREDITS} crédits offerts à l'inscription`,
        },
        {
          "@type": "Offer",
          name: ONESHOT_PACK.name,
          price: (ONESHOT_PACK.priceEurCents / 100).toFixed(2),
          priceCurrency: "EUR",
          description: `${ONESHOT_PACK.credits} retouches sans engagement — crédits sans expiration`,
        },
        {
          "@type": "Offer",
          name: STARTER.name,
          price: (STARTER.monthlyPriceEurCents / 100).toFixed(2),
          priceCurrency: "EUR",
          description: `${STARTER.creditsPerMonth} retouches/mois — idéal pour démarrer`,
        },
        {
          "@type": "Offer",
          name: PRO.name,
          price: (PRO.monthlyPriceEurCents / 100).toFixed(2),
          priceCurrency: "EUR",
          description: `${PRO.creditsPerMonth} retouches/mois — pour professionnels actifs`,
        },
        {
          "@type": "Offer",
          name: BUSINESS.name,
          price: (BUSINESS.monthlyPriceEurCents / 100).toFixed(2),
          priceCurrency: "EUR",
          description: `${BUSINESS.creditsPerMonth} retouches/mois — pour agences et gros volumes`,
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
    // Pas d'aggregateRating tant qu'il n'existe pas de vrais avis publiés sur
    // le site : les notes en données structurées doivent refléter des avis
    // réels et vérifiables (guidelines Google — risque de pénalité manuelle
    // sinon). À réintroduire quand de vrais avis clients seront collectés.
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
          text: "Pictaura optimise automatiquement vos photos Airbnb : redimensionnement à 1920×1280 pixels (ratio 3:2), amélioration de la luminosité et du contraste, upscaling IA pour une netteté maximale, et compression JPEG optimisée. En moins de 30 secondes par photo, vos visuels sont prêts à être publiés.",
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
          text: `Oui, Pictaura offre ${FREE_SIGNUP_CREDITS} crédits gratuits à l'inscription, sans carte bancaire requise. 1 crédit = 1 photo traitée. Ensuite, trois abonnements sont disponibles : ${STARTER.name} (${formatEur(STARTER.monthlyPriceEurCents)}/mois, ${STARTER.creditsPerMonth} retouches), ${PRO.name} (${formatEur(PRO.monthlyPriceEurCents)}/mois, ${PRO.creditsPerMonth} retouches) et ${BUSINESS.name} (${formatEur(BUSINESS.monthlyPriceEurCents)}/mois, ${BUSINESS.creditsPerMonth} retouches). Un pack one-shot de ${ONESHOT_PACK.credits} crédits à ${formatEur(ONESHOT_PACK.priceEurCents)} est aussi disponible sans engagement.`,
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
          text: "La retouche sur instruction permet de modifier une photo en langage naturel. Par exemple : 'Retire le canapé rouge', 'Débâche la piscine', 'Nettoie les taches sur le vêtement'. Pictaura utilise l'IA générative pour exécuter la modification automatiquement en moins de 30 secondes.",
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
