import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectMimeFromMagicBytes } from "@/services/storage";

export const maxDuration = 30;

/**
 * Logo de marque du client — filigrane personnalisé du plan Agence.
 *
 * GET    : indique si un logo est enregistré
 * POST   : téléverse (remplace) le logo
 * DELETE : retire le logo, les photos repartent sans filigrane
 *
 * Réservé au plan Agence. Le contrôle se fait ici ET dans le pipeline :
 * un client qui rétrograde vers Pro garde la ligne en base mais le pipeline
 * cesse de l'appliquer — on ne supprime pas son logo, on l'ignore, pour
 * qu'un réabonnement le retrouve intact.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

async function requireAgence() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, planId: true, role: true, brandLogoKey: true },
  });
  if (!user) {
    return { error: NextResponse.json({ error: "Compte introuvable" }, { status: 404 }) };
  }
  const autorise = user.role === "ADMIN" || user.planId === "business";
  if (!autorise) {
    return {
      error: NextResponse.json(
        { error: "Le filigrane personnalisé est réservé au plan Agence." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export async function GET() {
  const { error, user } = await requireAgence();
  if (error) return error;
  return NextResponse.json({ hasLogo: Boolean(user!.brandLogoKey) });
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAgence();
  if (error) return error;

  if (!checkRateLimit(`brandlogo:${user!.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const fichier = form?.get("logo");
  if (!(fichier instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (fichier.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo trop lourd (2 Mo maximum)." }, { status: 400 });
  }

  const buffer = Buffer.from(await fichier.arrayBuffer());

  // Le type déclaré par le navigateur n'est pas une preuve : on lit les
  // octets d'en-tête, comme pour les photos uploadées.
  const mime = detectMimeFromMagicBytes(buffer);
  if (!mime || !ALLOWED.includes(mime)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez un PNG, JPEG ou WebP." },
      { status: 400 }
    );
  }

  // Normalisation en PNG : la transparence est conservée, et le pipeline
  // reçoit toujours le même format quel que soit ce qu'a envoyé le client.
  let normalise: Buffer;
  try {
    normalise = await sharp(buffer)
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Image illisible." }, { status: 400 });
  }

  const cle = `brand-logos/${user!.id}/${uuidv4()}.png`;
  await uploadToR2(cle, normalise, "image/png");
  await prisma.user.update({ where: { id: user!.id }, data: { brandLogoKey: cle } });

  return NextResponse.json({ ok: true, hasLogo: true });
}

export async function DELETE() {
  const { error, user } = await requireAgence();
  if (error) return error;
  await prisma.user.update({ where: { id: user!.id }, data: { brandLogoKey: null } });
  return NextResponse.json({ ok: true, hasLogo: false });
}
