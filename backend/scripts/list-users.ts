import prisma from "../src/prisma/client";
async function main() {
  const users = await prisma.usuario.findMany({ select: { email: true, nombre: true, activo: true }});
  console.log(JSON.stringify(users, null, 2));
}
main().finally(() => prisma.$disconnect());
