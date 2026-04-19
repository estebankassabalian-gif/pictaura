import {
  Camera,
  Video,
  Music2,
  Image as ImageLucide,
  ShoppingBag,
  Shirt,
  Store,
  Package,
  Tag,
  Home,
  Building2,
  BedDouble,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export interface Platform {
  id: string;
  name: string;
  ratio: string;
  dimensions: string;
  /** Target width in px — used by the post-process Sharp crop */
  width: number;
  /** Target height in px — used by the post-process Sharp crop */
  height: number;
  description: string;
  icon: LucideIcon;
  /** Prompt hint appended to the user instruction to orient the retouche */
  promptHint: string;
}

/**
 * Platforms per preset. The user can optionally select one to adapt the
 * retouche to the platform's codes (format, framing, color, mood).
 */
export const PLATFORMS: Record<string, Platform[]> = {
  INSTAGRAM: [
    {
      id: "instagram-feed",
      name: "Instagram Feed",
      ratio: "4:5",
      dimensions: "1080×1350",
      width: 1080,
      height: 1350,
      description: "Portrait — format feed recommandé",
      icon: Camera,
      promptHint:
        "Target platform: Instagram feed (portrait 4:5, 1080×1350). Reframe composition as vertical portrait with subject centered using rule of thirds. Apply a modern editorial Instagram grade: slightly warm highlights, lifted blacks, natural saturation. Output must feel curated and premium.",
    },
    {
      id: "instagram-square",
      name: "Instagram Carré",
      ratio: "1:1",
      dimensions: "1080×1080",
      width: 1080,
      height: 1080,
      description: "Format carré classique",
      icon: ImageLucide,
      promptHint:
        "Target platform: Instagram square (1:1, 1080×1080). Reframe as a balanced square composition with subject perfectly centered. Clean editorial grade, premium feel.",
    },
    {
      id: "instagram-reels",
      name: "Reels / Story",
      ratio: "9:16",
      dimensions: "1080×1920",
      width: 1080,
      height: 1920,
      description: "Vertical plein écran",
      icon: Video,
      promptHint:
        "Target platform: Instagram Reels/Story (vertical 9:16, 1080×1920). Reframe as full-height vertical with subject filling the frame. Safe zones: keep key elements away from the top 15% and bottom 20% (UI overlays). Bold contrast, vibrant saturation for mobile impact.",
    },
    {
      id: "tiktok",
      name: "TikTok",
      ratio: "9:16",
      dimensions: "1080×1920",
      width: 1080,
      height: 1920,
      description: "Vertical mobile-first",
      icon: Music2,
      promptHint:
        "Target platform: TikTok (vertical 9:16, 1080×1920). Reframe as vertical with subject centered. Safe zones: top 15% and bottom 20% reserved for UI. Punchy contrast, saturated colors, youthful mood optimized for mobile scrolling.",
    },
    {
      id: "pinterest",
      name: "Pinterest",
      ratio: "2:3",
      dimensions: "1000×1500",
      width: 1000,
      height: 1500,
      description: "Épingle verticale optimale",
      icon: ImageLucide,
      promptHint:
        "Target platform: Pinterest (portrait 2:3, 1000×1500). Reframe as elongated portrait. Soft, aesthetic mood, warm and aspirational tones — photo must feel worth pinning and inspire mood boards.",
    },
  ],

  SHOPIFY: [
    {
      id: "shopify",
      name: "Shopify",
      ratio: "1:1",
      dimensions: "2048×2048",
      width: 2048,
      height: 2048,
      description: "Boutique en ligne — fond blanc",
      icon: Store,
      promptHint:
        "Target platform: Shopify product listing (square 1:1, 2048×2048). Pure white background (#FFFFFF). Product perfectly centered, 75-80% of the frame. Soft natural drop shadow under the product. Studio lighting, high sharpness, true color accuracy.",
    },
    {
      id: "amazon",
      name: "Amazon",
      ratio: "1:1",
      dimensions: "2000×2000",
      width: 2000,
      height: 2000,
      description: "Standard Amazon — fond blanc strict",
      icon: ShoppingBag,
      promptHint:
        "Target platform: Amazon main image (square 1:1, 2000×2000). Strict pure white background (#FFFFFF) as required by Amazon guidelines. Product fills 85% of the frame, centered, no props, no text, no accessories, no shadow on background. Crisp and professional.",
    },
    {
      id: "etsy",
      name: "Etsy",
      ratio: "1:1",
      dimensions: "2000×2000",
      width: 2000,
      height: 2000,
      description: "Artisanal — ambiance chaleureuse",
      icon: Package,
      promptHint:
        "Target platform: Etsy listing (square 1:1, 2000×2000). Warm, handcrafted aesthetic — light beige, linen, or wooden surface. Soft natural light, artisanal mood, cozy premium feel. Product as clear hero with subtle lifestyle context.",
    },
    {
      id: "vinted",
      name: "Vinted",
      ratio: "3:4",
      dimensions: "1200×1600",
      width: 1200,
      height: 1600,
      description: "Seconde main — portrait neutre",
      icon: Shirt,
      promptHint:
        "Target platform: Vinted (portrait 3:4, 1200×1600). Neutral clean background (white, beige or light gray). Item perfectly flat-lay or on hanger, well-lit, wrinkles removed, colors true-to-life. Keep it honest — do not hide defects. Mobile-first framing.",
    },
    {
      id: "leboncoin",
      name: "Leboncoin",
      ratio: "4:3",
      dimensions: "1200×900",
      width: 1200,
      height: 900,
      description: "Annonce claire et nette",
      icon: Tag,
      promptHint:
        "Target platform: Leboncoin (landscape 4:3, 1200×900). Bright clear lighting, neutral background, product well framed and easy to identify at a glance. Honest, trustworthy presentation — enhance lighting and sharpness without hiding condition.",
    },
  ],

  IMMOBILIER: [
    {
      id: "seloger",
      name: "SeLoger",
      ratio: "4:3",
      dimensions: "1200×900",
      width: 1200,
      height: 900,
      description: "Annonces immobilières FR",
      icon: Home,
      promptHint:
        "Target platform: SeLoger listing (landscape 4:3, 1200×900). Bright, spacious, inviting interior. Corrected vertical perspective, natural warm lighting, window highlights recovered. Must make the property look move-in ready.",
    },
    {
      id: "airbnb",
      name: "Airbnb",
      ratio: "16:9",
      dimensions: "2048×1152",
      width: 2048,
      height: 1152,
      description: "Location courte durée",
      icon: BedDouble,
      promptHint:
        "Target platform: Airbnb (landscape 16:9, 2048×1152). Wide cinematic composition. Warm, welcoming ambiance — inviting light, cozy mood, hospitality feel. Spaces must look bright, clean, and vacation-ready. Straight vertical lines.",
    },
    {
      id: "booking",
      name: "Booking",
      ratio: "3:2",
      dimensions: "1500×1000",
      width: 1500,
      height: 1000,
      description: "Hôtellerie & voyageurs",
      icon: Building2,
      promptHint:
        "Target platform: Booking.com (landscape 3:2, 1500×1000). Hospitality-grade photography: bright, neutral-to-warm tones, premium cleanliness feel, perfectly exposed interiors and well-preserved window views.",
    },
    {
      id: "leboncoin-immo",
      name: "Leboncoin Immo",
      ratio: "4:3",
      dimensions: "1200×900",
      width: 1200,
      height: 900,
      description: "Petites annonces immo",
      icon: MapPin,
      promptHint:
        "Target platform: Leboncoin immobilier (landscape 4:3, 1200×900). Clear, bright, honest presentation. Corrected perspective, natural colors, spaces that feel spacious and ready to visit.",
    },
    {
      id: "idealista",
      name: "Idealista",
      ratio: "4:3",
      dimensions: "1200×900",
      width: 1200,
      height: 900,
      description: "Marché espagnol / européen",
      icon: Home,
      promptHint:
        "Target platform: Idealista (landscape 4:3, 1200×900). Mediterranean inspired warmth, bright spacious feel, natural light emphasized. Exterior shots: vibrant blue sky, lush greenery. Interior shots: warm cozy tones.",
    },
  ],
};

export function getPlatformsForPreset(preset: string): Platform[] {
  return PLATFORMS[preset] ?? [];
}

export function getPlatformById(preset: string, platformId: string): Platform | undefined {
  return PLATFORMS[preset]?.find((p) => p.id === platformId);
}
