import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const allowed = checkRateLimit(`forgot-pw:${ip}`, 3, 15 * 60 * 1000); // 3 per 15 min
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  // Always return success to prevent email enumeration
  const successResponse = NextResponse.json({
    message: "Si un compte existe avec cet email, un lien de reinitialisation a ete envoye.",
  });

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.passwordHash) return successResponse;

  // Generate secure token
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Clean up old tokens for this user, then create new one
  await prisma.verificationToken.deleteMany({
    where: { identifier: `password-reset:${user.id}` },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: `password-reset:${user.id}`,
      token,
      expires,
    },
  });

  // Send email (fire-and-forget to avoid timing attacks)
  sendPasswordResetEmail({ to: normalized, token }).catch((err) =>
    console.error("Failed to send password reset email:", err)
  );

  return successResponse;
}
