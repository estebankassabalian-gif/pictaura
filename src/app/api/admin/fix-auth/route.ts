import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const TOKEN = "pictaura-fix-2026-xK9mP";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check DB connection and find admin user
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, isActive: true, passwordHash: true },
    });

    return NextResponse.json({
      ok: true,
      userCount: users.length,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        hasPasswordHash: !!u.passwordHash,
        hashPrefix: u.passwordHash?.substring(0, 10) ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL not set" }, { status: 500 });
  }

  try {
    const newPassword = "Pictaura2026!";
    const hash = await bcrypt.hash(newPassword, 12);

    const result = await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { passwordHash: hash, isActive: true, role: "ADMIN" },
    });

    return NextResponse.json({
      ok: true,
      updated: result.count,
      email: adminEmail,
      newPassword,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
