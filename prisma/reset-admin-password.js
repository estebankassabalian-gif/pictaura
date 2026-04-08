const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("No ADMIN_EMAIL set, skipping password reset");
    return;
  }

  const newPassword = "Pictaura2026!";
  const hash = await bcrypt.hash(newPassword, 12);

  const result = await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { passwordHash: hash },
  });

  if (result.count > 0) {
    console.log("Admin password reset OK for " + adminEmail);
  } else {
    console.log("No user found with email " + adminEmail);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
