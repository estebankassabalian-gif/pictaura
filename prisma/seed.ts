import { PrismaClient, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL env var is required for seed");
  }

  // ─── Admin user ───────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("changeme-immediately", 12);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Esteban (Admin)",
        role: Role.ADMIN,
        credits: 999999,
        emailVerified: new Date(),
        passwordHash,
      },
    });

    await prisma.creditTransaction.create({
      data: {
        userId: admin.id,
        type: TransactionType.ADMIN_GRANT,
        amount: 999999,
        balanceAfter: 999999,
        description: "Admin initial credits",
      },
    });

    console.log(`✅ Admin créé : ${adminEmail}`);
  } else {
    // Ensure admin has correct role
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });
    console.log(`✅ Admin existant mis à jour : ${adminEmail}`);
  }

  // ─── Credit packs ─────────────────────────────────────────
  // Les stripePriceId doivent être définis dans les env vars
  const packs = [
    {
      name: "Pack Starter",
      credits: 20,
      priceEurCents: 500,
      stripePriceId: process.env.STRIPE_PRICE_STARTER || "price_placeholder_starter",
      displayOrder: 1,
    },
    {
      name: "Pack Pro",
      credits: 75,
      priceEurCents: 1500,
      stripePriceId: process.env.STRIPE_PRICE_PRO || "price_placeholder_pro",
      displayOrder: 2,
    },
    {
      name: "Pack Studio",
      credits: 200,
      priceEurCents: 3000,
      stripePriceId: process.env.STRIPE_PRICE_STUDIO || "price_placeholder_studio",
      displayOrder: 3,
    },
  ];

  for (const pack of packs) {
    await prisma.creditPack.upsert({
      where: { stripePriceId: pack.stripePriceId },
      update: {
        name: pack.name,
        credits: pack.credits,
        priceEurCents: pack.priceEurCents,
        displayOrder: pack.displayOrder,
      },
      create: pack,
    });
  }

  console.log("✅ Credit packs créés/mis à jour");
  console.log("\n⚠️  IMPORTANT : Changer le mot de passe admin après le premier login !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
