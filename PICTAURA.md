# Pictaura — Récapitulatif back-end + front-end

> État au 2026-04-15. Sert de source de vérité avant la restructuration de la landing en 3 dashboards (Immobilier / Réseaux sociaux / E-commerce).

---

## 1. Identité produit

- **Nom** : Pictaura (ex-PhotoPack, rebranding v2 en cours)
- **Domaine** : pictaura.app
- **Promesse** : retouche photo IA + **SEO gravé dans le fichier** (EXIF + JSON-LD), formats optimisés par plateforme, en 30 s
- **Cible** : pros qui publient beaucoup de photos (agents immo, vendeurs Vinted, e-commerçants, créateurs de contenu)
- **Différenciateur clé** : le SEO / référencement Google intégré à chaque photo — personne d'autre ne le fait sur ce segment

---

## 2. Modèle économique

Défini dans [src/config/plans.ts](app-retouche-photo/src/config/plans.ts).

- **Essai** : `FREE_SIGNUP_CREDITS = 5` retouches offertes à l'inscription
- **Plan unique Pro** : `89 €/mois`, `200 retouches/mois`, soit `0,45 €/photo`
- **Contraintes techniques** :
  - `MAX_PHOTOS_PER_BATCH = 5`
  - `MAX_FILE_SIZE_MB = 50` (reflex pro compatible)
  - Formats : JPEG, PNG, WebP, HEIC, HEIF
- **Watermark** : les non-abonnés ont un watermark texte "PICTAURA / pictaura.app" centré (impossible à cropper) — [src/services/watermark.ts](app-retouche-photo/src/services/watermark.ts). **À remplacer** par le nouveau logo transparent.
- **Admin** (Esteban) : rôle `ADMIN` = crédits illimités + pas de watermark

---

## 3. Stack technique

| Couche | Techno |
|---|---|
| Framework | Next.js 15.5.12 (App Router) + TypeScript |
| Auth | NextAuth v5 (Google OAuth + email/password) |
| DB | PostgreSQL + Prisma ORM |
| Paiement | Stripe (abonnement Pro + webhooks) |
| Stockage photos | Cloudflare R2 (keys originalKey / processedKey) |
| Retouche IA | Google Gemini (principal) + Replicate (real-esrgan, remove-bg, flux-fill-pro, instruct-pix2pix) |
| SEO / Score | OpenAI GPT-4o-mini (génération EXIF + notation photo) |
| Email transactionnel | Resend |
| Traitement image | Sharp.js (watermark, EXIF, composition) |
| UI | Tailwind CSS + Framer Motion |
| Déploiement | Docker → Coolify (159.69.219.118) |

Variables d'env : voir [src/config/env.ts](app-retouche-photo/src/config/env.ts). Toutes validées au démarrage via Zod.

---

## 4. Schéma base de données

Source : [prisma/schema.prisma](app-retouche-photo/prisma/schema.prisma).

### Modèles principaux
- **User** : email, password (hash), name, role (USER/ADMIN), credits, `isSubscribed` (flag watermark retiré), stripeCustomerId, referralCode
- **ProcessingJob** : userId, preset, subOption, status, photos[], completedAt, errorMsg
- **ProcessedPhoto** : jobId, originalKey (R2), processedKey (R2), fileSize, **7 champs SEO** (`seoAltText`, `seoFileName`, `seoDescription`, `seoKeywords`, `seoMetaTitle`, `seoHashtags`, `seoSchemaJson`), `photoScore`, `photoScoreReport`, instruction
- **InpaintingJob** : userId, sourcePhotoId, maskKey, prompt, status, resultKey
- **CreditTransaction** : userId, type, amount, jobId, stripePaymentIntentId (idempotence)
- **CreditPack** : offres one-shot (hors abonnement)
- **Referral** : referrerId, refereeId, bonusCredits

### Enums
- **Preset** : `AIRBNB, IMMOBILIER, INSTAGRAM, VINTED, SHOPIFY`
- **JobStatus** : `PENDING, PROCESSING, COMPLETED, FAILED, AWAITING_VALIDATION, REJECTED`
- **TransactionType** : `PURCHASE, FREE_SIGNUP, ADMIN_GRANT, USAGE, REFUND, REFERRAL`

---

## 5. Agents IA (presets métier)

Source : [src/config/agents.ts](app-retouche-photo/src/config/agents.ts).

4 agents configurés, chacun avec `systemPrompt` (anglais) + `analyzePrompt` (retour JSON) + liste de `suggestions` cliquables :

| ID | Label UI | Focus |
|---|---|---|
| `IMMOBILIER` | Immobilier | Lumière, verticalité, ambiance habitation, dé-clutter, plafond propre |
| `INSTAGRAM` | Instagram / Réseaux | Contraste, saturation, format carré/vertical, ambiance lifestyle |
| `VINTED` | Vinted / Marketplace | Fond neutre, objet centré, texture du tissu, détails fidèles |
| `SHOPIFY` | E-commerce | Fond blanc pur, ombre portée douce, produit centré, cohérence catalogue |

Tous les prompts interdisent explicitement l'ajout de texte, logo ou watermark par l'IA.

---

## 6. Pipeline de traitement

Source : [src/services/processing/pipeline.ts](app-retouche-photo/src/services/processing/pipeline.ts).

1. Job `PENDING` → passe en `PROCESSING`
2. Photos traitées **par lots de 2** (concurrence contrôlée)
3. Pour chaque photo :
   1. Download original depuis R2 (URL signée)
   2. Retouche via **Gemini** (`retouchPhoto`) avec le `systemPrompt` du preset + instruction utilisateur
   3. Si **non abonné** → `applyWatermark()` (texte centré, impossible à cropper)
   4. Upload du résultat sur R2 → `processedKey`
   5. Photo marquée `COMPLETED` **immédiatement** (UX rapide)
   6. **En tâche de fond (non bloquant)** : génération SEO + scoring via OpenAI → injection EXIF (`injectExifMetadata`) → re-upload → update DB avec champs SEO
4. Job final `COMPLETED` (même avec échecs partiels) ou `FAILED`
5. Email de fin via Resend si user a un nom

### Presets de post-traitement
Dossier [src/services/processing/presets/](app-retouche-photo/src/services/processing/presets/) : `airbnb.ts`, `instagram.ts`, `vinted.ts`, `shopify.ts` — plus `exif.ts` (injection métadonnées), `zip.ts` (téléchargement groupé), `ken-burns.ts` (Reels).

---

## 7. Routes API

Source : `src/app/api/**/route.ts` (23 routes).

### Auth & compte
- `auth/[...nextauth]` — NextAuth endpoints
- `register` — création compte + 5 crédits gratuits
- `auth/forgot-password` + `auth/reset-password`
- `account/update-name`, `account/change-password`, `account/delete`

### Traitement photo
- `analyze-ai` — analyse de l'image pour suggestions
- `analyze-retouche` — analyse avant/après
- `process/[jobId]` — kick off du traitement
- `reprocess` — relance d'un job
- `reel` — mode Reels / Ken Burns
- `inpaint`, `inpaint-validate`, `inpaint-direct` — FLUX Fill Pro masking

### Jobs & médias
- `jobs` (list), `jobs/[jobId]` (détail), `jobs/[jobId]/photos`, `jobs/[jobId]/download` (ZIP)

### Paiement
- `checkout` — création session Stripe
- `billing/portal` — portail client Stripe
- `webhooks/stripe` — gestion abonnements + crédits

### Admin
- `admin/jobs/force-fail` — reset job bloqué

---

## 8. Libs transverses

Source : [src/lib/](app-retouche-photo/src/lib/).

- `prisma.ts` — client Prisma
- `auth.config.ts` + `auth.ts` — NextAuth v5
- `rate-limit.ts` — protection des routes sensibles
- `openai.ts` — GPT-4o-mini (SEO + scoring photo)
- `gemini.ts` — Google AI (retouche image principale)
- `replicate.ts` — 4 modèles : real-esrgan, rembg, flux-fill-pro, instruct-pix2pix
- `r2.ts` — upload / signed URLs Cloudflare R2
- `stripe.ts` — client lazy-init
- `email.ts` — Resend (job completed, reset password, etc.)

---

## 9. Front-end — état actuel

### Design tokens (rebranding v2)
- `globals.css` + `tailwind.config.ts` : palette `cream` (#FFFBF5) / `navy` (#031D68) / `orange` (#F87005) / dégradés
- `layout.tsx` : polices, metadata, providers
- `components/brand/Logo.tsx` : logo rebrandé (horizontal + mark)
- `components/brand/VoronoiBackground.tsx` : **fond dégradé CSS** (orange bas-gauche → navy haut-droite), utilisé sur landing + auth + dashboard

### Landing (public)
- **Fichier principal** : [src/components/landing/LandingClient.tsx](app-retouche-photo/src/components/landing/LandingClient.tsx) (858 lignes, `"use client"`)
- Sections actuelles : Hero, Stats, Plateformes, Comment ça marche, 3 cartes humbles (ex-tableau comparatif), Pricing (1 carte Pro), FAQ, CTA final, Footer
- **À restructurer** en **3 sections dashboards** : Immobilier / Réseaux sociaux / E-commerce
- Pages secondaires : `/contact`, `/cgu`, `/politique-confidentialite` (Phase D)

### App authentifiée
- `/app` — dashboard utilisateur
- `/app/upload` — upload + choix preset + lancement job
- `/app/jobs/[jobId]` — suivi temps réel + résultats
- `/app/jobs/[jobId]/results` — galerie avant/après + download ZIP
- `/app/account` — profil, mot de passe, suppression
- `/app/billing` — abonnement Stripe
- `/app/admin/*` — outils admin (jobs bloqués, stats)

### Auth
- `/login`, `/register`, `/forgot-password`, `/reset-password`

---

## 10. Points à traiter (prochaine étape)

D'après la demande utilisateur :

1. **Fond dégradé appliqué à toute la landing** (pas seulement le hero)
2. **Landing restructurée en 3 sections dashboards distincts** :
   - 🏠 **Immobilier** (preset IMMOBILIER/AIRBNB)
   - 📱 **Réseaux sociaux** (preset INSTAGRAM)
   - 🛒 **E-commerce** (presets VINTED + SHOPIFY)
3. **Mise en avant forte** de la retouche IA + **du SEO/référencement Google** (le vrai différenciateur)
4. **Watermark transparent** : remplacer le texte "PICTAURA" par le **logo transparent** en overlay sur les photos d'essai
5. **Réécriture complète des textes** de la landing : pas d'erreur, pas de remplissage, ton pro et coloré
6. **Back-end intouchable** : toutes les modifs restent front-end + assets

---

## 11. Contraintes rappelées

- Site **déjà en production** (domaine pictaura.app live) — ne rien casser
- Déploiement auto via Coolify sur push master → **travailler en local d'abord**, pas de push sans validation
- Admin Esteban (role ADMIN) = crédits illimités, bypass watermark
- Les agents IA ne doivent **jamais** ajouter de texte/logo/filigrane via le prompt (c'est Sharp qui compose le watermark en post)
