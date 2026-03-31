export type RetouchingSuggestion = {
  label: string;  // affiché sur le bouton
  prompt: string; // envoyé à Gemini (anglais, précis)
  icon: string;   // emoji
};

/**
 * Suggestions de retouche par secteur business.
 * Utilisées comme fallback si l'analyse Gemini auto échoue,
 * et comme suggestions "rapides" cliquables dans l'UI.
 *
 * Prompts en anglais pour de meilleures performances Gemini.
 */
export const DEFAULT_SUGGESTIONS: Record<string, RetouchingSuggestion[]> = {

  // Cible : agences immobilières, promoteurs, photographes immo
  IMMOBILIER: [
    {
      label: "Ciel bleu & lumineux",
      prompt: "Replace the sky with a bright blue sky with light fluffy clouds, professional real estate photography look",
      icon: "🌤",
    },
    {
      label: "Éclairage intérieur naturel",
      prompt: "Enhance interior lighting to look natural and warm, remove harsh shadows and dark corners, professional real estate quality",
      icon: "💡",
    },
    {
      label: "Retirer voitures & passants",
      prompt: "Remove all parked cars, pedestrians and street clutter from the scene, keep the building facade clean and clear",
      icon: "🚗",
    },
    {
      label: "Pelouse & jardin verts",
      prompt: "Make the grass lush and vibrant green, remove dead or dry patches, add life to the garden area",
      icon: "🌿",
    },
    {
      label: "Retirer câbles électriques",
      prompt: "Remove all electrical wires, utility poles and overhead cables from the image cleanly",
      icon: "⚡",
    },
    {
      label: "Déboucher la piscine",
      prompt: "Make the pool water crystal clear, clean and bright blue, remove any green, murky or dirty water appearance",
      icon: "🏊",
    },
    {
      label: "Mise en scène virtuelle",
      prompt: "Add tasteful virtual furniture staging to empty rooms: modern sofa, coffee table, plants, neutral color palette, high-end interior design style",
      icon: "🛋",
    },
    {
      label: "Façade propre & nette",
      prompt: "Clean the building facade thoroughly: remove stains, graffiti, moss, weathering marks and discoloration",
      icon: "🏠",
    },
  ],

  // Fallback pour AIRBNB (ancien preset, même suggestions qu'IMMOBILIER)
  AIRBNB: [
    {
      label: "Ciel bleu & lumineux",
      prompt: "Replace the sky with a bright blue sky with light fluffy clouds, professional real estate photography look",
      icon: "🌤",
    },
    {
      label: "Éclairage intérieur naturel",
      prompt: "Enhance interior lighting to look natural and warm, remove harsh shadows and dark corners",
      icon: "💡",
    },
    {
      label: "Retirer voitures & passants",
      prompt: "Remove all parked cars, pedestrians and street clutter from the scene",
      icon: "🚗",
    },
    {
      label: "Pelouse & jardin verts",
      prompt: "Make the grass lush and vibrant green, remove dead or dry patches",
      icon: "🌿",
    },
    {
      label: "Déboucher la piscine",
      prompt: "Make the pool water crystal clear, clean and bright blue",
      icon: "🏊",
    },
    {
      label: "Mise en scène virtuelle",
      prompt: "Add tasteful virtual furniture staging to empty rooms: modern sofa, coffee table, plants, neutral tones",
      icon: "🛋",
    },
  ],

  // Cible : e-commerçants Shopify, dropshippers, marques DTC
  SHOPIFY: [
    {
      label: "Fond blanc studio",
      prompt: "Replace the background with a pure clean white (#FFFFFF), professional product photography look, no shadows on background",
      icon: "⬜",
    },
    {
      label: "Fond gris studio",
      prompt: "Replace the background with a light neutral grey studio background, subtle gradient, professional e-commerce standard",
      icon: "🎨",
    },
    {
      label: "Ombre portée pro",
      prompt: "Add a soft, realistic natural drop shadow directly beneath the product, studio lighting effect, keep it subtle",
      icon: "🔦",
    },
    {
      label: "Centrer le produit",
      prompt: "Automatically crop and center the product with equal margins on all sides, square format, perfect product shot",
      icon: "📐",
    },
    {
      label: "Retirer étiquettes prix",
      prompt: "Remove all price tags, stickers, barcodes and adhesive labels from the product cleanly",
      icon: "🏷",
    },
    {
      label: "Éclairage premium",
      prompt: "Enhance product lighting to look premium, bright, sharp and highly desirable, as if shot in a professional photo studio with softboxes",
      icon: "✨",
    },
    {
      label: "Améliorer les textures",
      prompt: "Enhance and sharpen product texture details: make fabric, leather, metal or glass surfaces look premium, crisp and tactile",
      icon: "🔍",
    },
    {
      label: "Packshot lifestyle",
      prompt: "Place the product in a minimal, elegant lifestyle context appropriate for its category, keep the product sharp and prominent in the foreground",
      icon: "📦",
    },
  ],

  // Cible : revendeurs Vinted, LeBonCoin, dépôts-ventes, friperies
  VINTED: [
    {
      label: "Fond blanc propre",
      prompt: "Replace the background with a pure clean white, product photography style for second-hand resale platform",
      icon: "⬜",
    },
    {
      label: "Retirer les faux plis",
      prompt: "Remove wrinkles, creases and fold marks from the clothing item, make the fabric look smooth and freshly ironed",
      icon: "👕",
    },
    {
      label: "Raviver les couleurs",
      prompt: "Enhance and saturate the fabric colors to make them look vibrant, rich and as-new without looking unnatural",
      icon: "🎨",
    },
    {
      label: "Retirer les taches",
      prompt: "Remove visible stains, marks, discolorations and spots from the clothing item cleanly",
      icon: "🧹",
    },
    {
      label: "Zoom produit centré",
      prompt: "Crop tightly around the clothing item, center it perfectly in the frame, remove all distracting background elements",
      icon: "🔍",
    },
    {
      label: "Atténuer l'usure",
      prompt: "Minimize visible signs of light wear: reduce pilling, slight fading, minor fabric wear and surface scuffs",
      icon: "✨",
    },
  ],

  // Cible : créateurs Instagram, UGC creators, influenceurs, marques lifestyle
  INSTAGRAM: [
    {
      label: "Peau parfaite naturelle",
      prompt: "Smooth skin texture naturally, remove blemishes, pimples and redness while preserving a completely natural, non-airbrushed look",
      icon: "✨",
    },
    {
      label: "Yeux expressifs",
      prompt: "Enhance eyes subtly: brighten the whites slightly, add gentle sharpness to the iris, completely natural result",
      icon: "👁",
    },
    {
      label: "Flou bokeh (arrière-plan)",
      prompt: "Apply a professional DSLR-style bokeh blur to the background, keep the subject in sharp focus, natural depth of field",
      icon: "📷",
    },
    {
      label: "Lumière heure dorée",
      prompt: "Apply a warm golden hour lighting effect: soft orange and yellow tones, cinematic warmth, magic hour atmosphere",
      icon: "🌅",
    },
    {
      label: "Ciel dramatique",
      prompt: "Replace the sky with a dramatic, visually striking sky: rich golden sunset or moody cinematic clouds for maximum visual impact",
      icon: "🌤",
    },
    {
      label: "Retirer éléments gênants",
      prompt: "Remove unwanted objects, distracting people or visual clutter from the background cleanly and seamlessly",
      icon: "🧹",
    },
    {
      label: "Preset film cinématique",
      prompt: "Apply a cinematic film color grade: slightly lifted blacks, warm highlights, rich contrast, analog film aesthetic",
      icon: "🎬",
    },
  ],
};
