import {
  Building2,
  Camera,
  Store,
  Sun,
  Cloud,
  Trash2,
  Leaf,
  Sofa,
  Zap,
  Droplets,
  PaintBucket,
  Sparkles,
  Eye,
  Aperture,
  Sunset,
  Film,
  Eraser,
  Square,
  Shirt,
  Palette,
  Lightbulb,
  Box,
  Tag,
  Crop,
  type LucideIcon,
} from "lucide-react";

export interface AgentSuggestion {
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  accentColor: string;
  systemPrompt: string;
  analyzePrompt: string;
  suggestions: AgentSuggestion[];
}

export const AGENTS: Record<string, AgentConfig> = {
  IMMOBILIER: {
    id: "IMMOBILIER",
    name: "Immobilier",
    description: "Optimisez vos photos pour vendre plus vite",
    icon: Building2,
    gradient: "from-brand-600 to-accent-500",
    accentColor: "#f87005",
    systemPrompt: `You are an elite real estate photographer and photo editor with 15 years of experience working for premium property agencies (Sotheby's, Christie's, Barnes).

Your expertise:
- Interior photography: warm lighting, HDR tone mapping, shadow lifting, window highlight recovery
- Exterior photography: sky replacement, lawn enhancement, facade cleaning
- Virtual staging: adding tasteful furniture to empty rooms
- Perspective correction: straightening vertical lines, lens distortion fix
- Color grading: warm inviting tones for interiors, natural vibrant for exteriors

RULES:
- Only perform visual photo editing. Professional quality, photorealistic output.
- Optimize every photo to sell the property — make spaces look bright, spacious, and inviting.
- Do not add text, logos, or watermarks.
- If the instruction is unrelated to photo editing, apply subtle brightness and contrast improvements only.`,

    analyzePrompt: `You are an elite real estate photography expert. Analyze this property photo and identify 3 to 5 specific improvements that would make it sell faster.
Focus on: lighting, sky quality, unwanted objects, vegetation, staging opportunities, perspective issues.
Respond ONLY with valid JSON (no markdown, no code block):
{"analysis":"one concise sentence describing the photo in French","suggestions":["improvement 1 in French","improvement 2 in French","improvement 3 in French"]}`,

    suggestions: [
      { label: "Éclaircir la pièce", prompt: "Enhance interior lighting to look natural and warm, remove harsh shadows, brighten dark corners while keeping a realistic professional look", icon: Sun },
      { label: "Remplacer le ciel", prompt: "Replace the sky with a bright blue sky with light scattered clouds, professional real estate look, photorealistic blending at roofline", icon: Cloud },
      { label: "Retirer éléments parasites", prompt: "Remove all unwanted objects: electrical wires, utility poles, trash bins, parked cars, street clutter. Keep the building and landscape clean", icon: Trash2 },
      { label: "Raviver la végétation", prompt: "Make the grass and garden lush, vibrant green. Remove dead or dry patches. Enhance trees and hedges to look healthy and maintained", icon: Leaf },
      { label: "Mise en scène virtuelle", prompt: "Add tasteful virtual furniture staging to this empty room: modern neutral-toned sofa, coffee table, plants, soft rug. Photorealistic, high-end interior design style", icon: Sofa },
      { label: "Nettoyer la façade", prompt: "Clean the building facade: remove stains, graffiti, moss, weathering marks, dirt. Make it look freshly maintained", icon: PaintBucket },
      { label: "Retirer câbles électriques", prompt: "Remove all electrical wires, cables, and utility poles from the image. Clean sky and facade", icon: Zap },
      { label: "Piscine propre", prompt: "Make the pool water crystal clear, bright blue and inviting. Remove any green tint, leaves, or debris", icon: Droplets },
    ],
  },

  INSTAGRAM: {
    id: "INSTAGRAM",
    name: "Instagram",
    description: "Sublimez vos contenus pour les réseaux sociaux",
    icon: Camera,
    gradient: "from-accent-400 to-accent-600",
    accentColor: "#EC4899",
    systemPrompt: `You are a top-tier creative director and photo editor specializing in Instagram, TikTok, and social media content creation. You work with major influencers and brands.

Your expertise:
- Portrait retouching: natural skin smoothing, eye enhancement, teeth whitening
- Background manipulation: bokeh blur, background cleanup, environment swap
- Color grading: cinematic (orange & teal), film (matte), warm (golden hour), moody, pop (vivid)
- Lighting effects: golden hour simulation, rim light, studio lighting emulation
- Composition: rule of thirds optimization, subject emphasis

RULES:
- Only perform visual photo editing. Professional quality, Instagram-worthy output.
- Make photos look premium and engaging — maximize visual impact for social media.
- Keep skin retouching natural — no plastic/artificial look.
- Do not add text, logos, or watermarks.
- If the instruction is unrelated to photo editing, apply a subtle cinematic color grade only.`,

    analyzePrompt: `You are a top creative director for Instagram content. Analyze this photo and identify 3 to 5 specific improvements that would maximize engagement on social media.
Focus on: skin quality, lighting, background, color mood, composition, visual impact.
Respond ONLY with valid JSON (no markdown, no code block):
{"analysis":"one concise sentence describing the photo in French","suggestions":["improvement 1 in French","improvement 2 in French","improvement 3 in French"]}`,

    suggestions: [
      { label: "Retouche portrait naturelle", prompt: "Smooth skin texture naturally, remove blemishes, pimples and redness. Brighten under-eye area. Keep texture and pores visible for a natural look", icon: Sparkles },
      { label: "Yeux expressifs", prompt: "Enhance eyes: brighten whites subtly, add sharpness to iris, enhance natural eye color slightly. Must look natural, not artificial", icon: Eye },
      { label: "Flou d'arrière-plan", prompt: "Apply professional DSLR-quality bokeh blur to background. Keep subject perfectly sharp with smooth falloff. Cinematic depth of field", icon: Aperture },
      { label: "Lumière heure dorée", prompt: "Apply warm golden hour lighting effect: soft orange/yellow sun rays, warm skin tones, golden highlights. Cinematic and dreamy", icon: Sunset },
      { label: "Color grading cinématique", prompt: "Apply cinematic film color grade: slightly lifted blacks, warm highlights, cool shadows (orange & teal split toning), high contrast. Hollywood look", icon: Film },
      { label: "Nettoyer l'arrière-plan", prompt: "Remove all unwanted objects, people, and distracting elements from the background. Keep the subject untouched. Clean, minimal background", icon: Eraser },
      { label: "Recadrer pour Instagram", prompt: "Crop and reframe the photo for optimal Instagram composition: center the subject, apply rule of thirds, ensure visual balance. Square 1:1 format", icon: Square },
    ],
  },

  SHOPIFY: {
    id: "SHOPIFY",
    name: "E-commerce",
    description: "Photos produit pro pour Shopify, Vinted, Etsy, Leboncoin",
    icon: Store,
    gradient: "from-blue-600 to-indigo-600",
    accentColor: "#2563EB",
    systemPrompt: `You are a premium e-commerce product photographer working for Shopify brands, Amazon sellers, DTC companies AND second-hand marketplaces (Vinted, Leboncoin, Etsy, Facebook Marketplace, eBay).

Your expertise:
- Studio white background (#FFFFFF) for product listings and marketplace standards
- Professional drop shadows and reflections
- Premium product lighting (highlight textures, materials, fabrics)
- Product centering with uniform margins
- Background removal and replacement
- Fabric enhancement: remove wrinkles, smooth creases, revive colors
- Wear/stain minimization for second-hand items (realistic, never deceptive)
- Color accuracy for online retail and peer-to-peer resale

RULES:
- Only perform visual photo editing. Professional e-commerce / marketplace output.
- White background is the gold standard for both Shopify listings and Vinted/Leboncoin/Etsy.
- Product must be the hero — sharp, well-lit, perfectly centered.
- Shadows must look natural and professional, not flat.
- Color accuracy is critical for resale — buyers must trust what they see.
- Do not add text, logos, or watermarks.
- If the instruction is unrelated to photo editing, apply white background and studio lighting only.`,

    analyzePrompt: `You are a premium product photography expert covering both catalog e-commerce (Shopify, Amazon) and second-hand marketplaces (Vinted, Leboncoin, Etsy). Analyze this product photo and identify 3 to 5 specific improvements.
Focus on: background, lighting quality, product centering, shadows, texture detail, fabric condition, overall professionalism.
Respond ONLY with valid JSON (no markdown, no code block):
{"analysis":"one concise sentence describing the photo in French","suggestions":["improvement 1 in French","improvement 2 in French","improvement 3 in French"]}`,

    suggestions: [
      { label: "Fond blanc studio", prompt: "Replace background with pure white (#FFFFFF) professional studio background. Clean product photography, no shadows on the background itself", icon: Square },
      { label: "Ombre portée réaliste", prompt: "Add a soft, realistic drop shadow under the product. Natural studio lighting effect. Professional e-commerce standard", icon: Lightbulb },
      { label: "Éclairage produit premium", prompt: "Enhance product lighting to look premium: bright, sharp, and desirable. Highlight textures and materials as if shot in a professional studio", icon: Sparkles },
      { label: "Cadrage centré uniforme", prompt: "Center the product perfectly with equal margins on all sides. Square format, product fills 70-80% of the frame. Professional e-commerce standard", icon: Crop },
      { label: "Retirer plis et faux-plis", prompt: "Remove wrinkles, creases and folds from clothing or soft items. Make the fabric look smooth, pressed and well-maintained", icon: Shirt },
      { label: "Raviver les couleurs produit", prompt: "Enhance and saturate the product colors to look vibrant, rich and true-to-life. Keep color accuracy for trust", icon: Palette },
      { label: "Retirer étiquettes prix", prompt: "Remove price tags, stickers, labels, barcodes from the product. Clean, tag-free product presentation", icon: Tag },
      { label: "Mise en scène lifestyle", prompt: "Place the product in a minimal, premium lifestyle context relevant to its category. Keep product sharp in foreground, soft contextual background", icon: Box },
    ],
  },
};

// Status badge classes for dark theme consistency
export function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-500/10 text-amber-400";
    case "PROCESSING":
      return "bg-blue-500/10 text-blue-400";
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-400";
    case "FAILED":
      return "bg-red-500/10 text-red-400";
    case "AWAITING_VALIDATION":
      return "bg-accent-500/10 text-accent-400";
    case "REJECTED":
      return "bg-zinc-500/10 text-zinc-400";
    default:
      return "bg-zinc-500/10 text-zinc-400";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "PROCESSING":
      return "En cours";
    case "COMPLETED":
      return "Termine";
    case "FAILED":
      return "Echoue";
    case "AWAITING_VALIDATION":
      return "A valider";
    case "REJECTED":
      return "Rejete";
    default:
      return status;
  }
}
