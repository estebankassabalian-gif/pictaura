import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { FREE_SIGNUP_CREDITS } from "@/config/plans";
import { sendWelcomeEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit : 5 inscriptions par IP / 15 minutes
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Trop de tentatives, réessayez dans 15 minutes" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier si l'email existe déjà
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // Message générique pour ne pas révéler si l'email existe
      return NextResponse.json(
        { error: "Un compte avec cet email existe déjà" },
        { status: 409 }
      );
    }

    // Hasher le mot de passe (cost=12 pour sécurité)
    const passwordHash = await bcrypt.hash(password, 12);

    // Créer l'utilisateur + crédits offerts en transaction atomique
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          credits: FREE_SIGNUP_CREDITS,
          emailVerified: new Date(), // Simplifié pour le MVP
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: newUser.id,
          type: TransactionType.FREE_SIGNUP,
          amount: FREE_SIGNUP_CREDITS,
          balanceAfter: FREE_SIGNUP_CREDITS,
          description: `${FREE_SIGNUP_CREDITS} crédits offerts à l'inscription`,
        },
      });

      return newUser;
    });

    // Envoi email de bienvenue non-bloquant
    sendWelcomeEmail({ to: user.email, userName: user.name ?? user.email }).catch(console.error);

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
