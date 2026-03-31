# PhotoPack — App Retouche Photo Location Saisonnière

## Description
SaaS web d'optimisation de photos par IA. Upload → preset → téléchargement ZIP.
Cible : hôtes Airbnb, créateurs Instagram, vendeurs Vinted, boutiques Shopify.

## Stack
- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth.js v5 (email + Google OAuth)
- Stripe (crédits à l'unité)
- Sharp.js + Replicate API (real-esrgan, remove-bg, flux-fill-pro)
- Anthropic Claude Haiku (SEO + score photo + inpainting prompt)
- Cloudflare R2 (stockage photos)
- Docker → Coolify

## Tarification
- 5 crédits gratuits à l'inscription
- Pack Starter : 5€ = 20 crédits
- Pack Pro : 15€ = 75 crédits
- Pack Studio : 30€ = 200 crédits
- Inpainting LLM : 3 crédits par retouche

## Presets
| Preset | Output |
|---|---|
| AIRBNB | 1920×1280, HDR, JPEG 85% |
| INSTAGRAM | 1080×1080 ou 4:5, saturation pop |
| VINTED | 1000×1000, fond blanc, product crop |
| SHOPIFY | 2048×2048, fond blanc pro |

## Features
- ✅ Traitement IA (real-esrgan upscaling)
- ✅ Suppression fond automatique (Vinted/Shopify)
- ✅ Retouche sur instruction LLM + inpainting FLUX
- ✅ SEO automatique (alt text + nom fichier)
- ✅ Score photo /10 avec rapport
- ✅ Téléchargement ZIP + CSV SEO
- ✅ Paiement Stripe (crédits)
- ✅ Admin panel (gestion users, crédits)

## Setup
1. Copier `.env.example` → `.env.local` et remplir les variables
2. `npm install`
3. `docker-compose up -d db`
4. `npx prisma migrate dev`
5. `npx tsx prisma/seed.ts`
6. `npm run dev`

## Comptes requis
- Cloudflare R2 : bucket "photopack-storage"
- Replicate : créditer $20+
- Stripe : 3 produits (Starter/Pro/Studio)
- Google OAuth : Console Cloud → credentials
- Resend : API key
- Anthropic : API key

## Déploiement Coolify
- Push sur GitHub
- Créer une app Coolify (Docker)
- Configurer les env vars
- `npx prisma migrate deploy && npx tsx prisma/seed.ts`
