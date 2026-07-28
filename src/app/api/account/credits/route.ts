import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/account/credits
 *
 * Le layout (app) est un Server Component qui ne se re-rend PAS sur les
 * navigations client-side entre pages soeurs (comportement standard du App
 * Router) — la sidebar affichait donc un solde de crédits figé au dernier
 * chargement complet, alors qu'une retouche ou une validation d'inpainting
 * modifie le solde en base pendant que l'utilisateur reste sur la même page
 * (ex: écran résultats). `auth()` relance le callback jwt qui relit
 * toujours les crédits en base (voir src/lib/auth.ts) — ce endpoint expose
 * juste ce résultat frais pour que la sidebar puisse se resynchroniser
 * sans recharger toute la page.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  return NextResponse.json({
    credits: isAdmin ? -1 : (session.user.credits ?? 0),
    isAdmin,
  });
}
