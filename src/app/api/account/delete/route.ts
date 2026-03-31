import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const password = (body as { password?: string }).password;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Impossible de supprimer un compte admin
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Les comptes administrateurs ne peuvent pas être supprimés" }, { status: 403 });
  }

  // Si le compte a un mot de passe, l'exiger pour confirmer
  if (user.passwordHash) {
    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression" }, { status: 400 });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 400 });
    }
  }

  // Supprimer le compte (cascade Prisma supprime les jobs, photos, transactions)
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
