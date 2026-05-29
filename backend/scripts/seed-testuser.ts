import bcrypt from "bcryptjs";
import prisma from "../src/prisma/client";
async function main() {
  const hash = await bcrypt.hash("test123", 10);
  await prisma.usuario.upsert({
    where: { email: "test@test.com" },
    update: { password: hash },
    create: { email: "test@test.com", nombre: "Test", password: hash },
  });
  console.log("OK: test@test.com / test123");
}
main().finally(() => prisma.$disconnect());
