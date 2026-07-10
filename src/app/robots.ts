import { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pictaura.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register", "/login", "/cgu", "/politique-confidentialite"],
        disallow: [
          "/dashboard",
          "/upload",
          "/results",
          "/billing",
          "/editor",
          "/admin",
          "/immobilier",
          "/instagram",
          "/shopify",
          "/reel",
          "/account",
          "/api/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
