import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Route temporaire de reset admin — protégée par token secret
// À supprimer après utilisation
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  // Token secret one-time — hardcodé ici uniquement pour ce deploy
  const RESET_TOKEN = "pictaura-reset-2026-xK9mP";

  if (token !== RESET_TOKEN) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (min 8)" }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL non configuré" }, { status: 500 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const result = await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { passwordHash: hash },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Aucun utilisateur trouvé" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: `Mot de passe mis à jour pour ${adminEmail}` });
}
