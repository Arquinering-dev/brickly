/**
 * Crea un usuario en la base de datos.
 * Uso: npx tsx scripts/create-user.ts
 */
import bcrypt from "bcryptjs";
import * as readline from "readline";
import prisma from "../src/prisma/client";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) =>
  new Promise<string>((resolve) => rl.question(q, resolve));

async function main() {
  console.log("\n--- Crear usuario de Groundwork ---\n");
  const email = (await ask("Email: ")).trim().toLowerCase();
  const nombre = (await ask("Nombre (opcional, Enter para omitir): ")).trim();
  const password = (await ask("Contraseña: ")).trim();
  rl.close();

  if (!email || !password) {
    console.error("Email y contraseña son requeridos.");
    process.exit(1);
  }

  const exists = await prisma.usuario.findUnique({ where: { email } });
  if (exists) {
    console.error(`\nYa existe un usuario con el email ${email}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.create({
    data: { email, nombre: nombre || null, password: hash },
  });

  console.log(`\nUsuario creado exitosamente:`);
  console.log(`  ID:     ${usuario.id}`);
  console.log(`  Email:  ${usuario.email}`);
  console.log(`  Nombre: ${usuario.nombre ?? "(sin nombre)"}\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
