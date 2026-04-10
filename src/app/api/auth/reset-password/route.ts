import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const allowed = checkRateLimit(`reset-pw:${ip}`, 5, 15 * 60 * 1000); // 5 per 15 min
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token invalide" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  // Find token
  const record = await prisma.verificationToken.findFirst({
    where: {
      token,
      identifier: { startsWith: "password-reset:" },
      expires: { gt: new Date() },
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: "Lien expire ou invalide. Demandez un nouveau lien." },
      { status: 400 }
    );
  }

  const userId = record.identifier.replace("password-reset:", "");

  // Hash new password and update user
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordVersion: { increment: 1 } },
  });

  // Delete used token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: record.identifier, token: record.token } },
  });

  return NextResponse.json({ message: "Mot de passe mis a jour. Vous pouvez vous connecter." });
}
