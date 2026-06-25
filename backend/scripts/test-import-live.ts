/**
 * Test de persistencia REAL del import del Resumen (obra creada → import → verificar conteos).
 * Uso: npx tsx scripts/test-import-live.ts <ruta.xlsx>
 * Limpia la obra que crea al terminar.
 */
import { readFileSync } from "fs";
import prisma from "../src/prisma/client";
import { importResumenXlsx } from "../src/services/resumen-import.service";

async function main() {
  const path = process.argv[2];
  if (!path) { console.error("Uso: npx tsx scripts/test-import-live.ts <ruta.xlsx>"); process.exit(1); }
  const buf = readFileSync(path);

  const codigo = "TEST" + Date.now();
  const obra = await prisma.obra.create({ data: { nombre: "TEST import", codigo, estado: "EN_PRESUPUESTO" } });
  console.log("Obra creada:", obra.id, obra.codigo);

  const r = await importResumenXlsx(buf, { filename: path.split("/").pop(), obraId: obra.id });
  console.log("Import result control:", JSON.stringify(r.control));
  console.log("warnings:", r.warnings.length, "errors:", r.errors);

  const [lineas, conGranular, mov, sub, quin, gas, contr, cert, certL, obraDb] = await Promise.all([
    prisma.lineaPresupuesto.count({ where: { obraId: obra.id } }),
    prisma.lineaPresupuesto.count({ where: { obraId: obra.id, rubroMt: { not: null } } }),
    prisma.movimiento.count({ where: { obraId: obra.id } }),
    prisma.subcontratoObra.count({ where: { obraId: obra.id } }),
    prisma.quincena.count({ where: { obraId: obra.id } }),
    prisma.gastoDirInd.count({ where: { obraId: obra.id } }),
    prisma.contratoCliente.count({ where: { obraId: obra.id } }),
    prisma.certificacion.count({ where: { contrato: { obraId: obra.id } } }),
    prisma.certificacionLinea.count({ where: { certificacion: { contrato: { obraId: obra.id } } } }),
    prisma.obra.findUnique({ where: { id: obra.id } }),
  ]);
  const movConRubro = await prisma.movimiento.count({ where: { obraId: obra.id, rubroContableId: { not: null } } });

  console.log("\n=== EN DB ===");
  console.log({ lineas, lineasConRubroGranular: conGranular, mov, movConRubro, sub, quin, gas, contr, cert, certL });
  console.log("Obra campos:", {
    coefGGBB: obraDb?.coefGGBB?.toString(), mesCacBase: obraDb?.mesCacBase,
    valorCacBase: obraDb?.valorCacBase?.toString(), costoControlable: obraDb?.costoControlable?.toString(),
    precioVentaTotal: obraDb?.precioVentaTotal?.toString(), nombre: obraDb?.nombre, estado: obraDb?.estado,
  });

  // Re-import (idempotencia): no debe duplicar
  await importResumenXlsx(buf, { filename: path.split("/").pop(), obraId: obra.id });
  const movAfter = await prisma.movimiento.count({ where: { obraId: obra.id } });
  console.log("\nRe-import → movimientos:", movAfter, movAfter === mov ? "(idempotente OK)" : "(¡DUPLICÓ!)");

  // Limpieza (igual que el endpoint DELETE /obras/:id)
  await prisma.$transaction([
    prisma.lineaPresupuesto.deleteMany({ where: { obraId: obra.id } }),
    prisma.presupuestoHeader.deleteMany({ where: { obraId: obra.id } }),
    prisma.partida.deleteMany({ where: { obraId: obra.id } }),
    prisma.obra.delete({ where: { id: obra.id } }),
  ]);
  console.log("Obra de test eliminada.");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("FALLO:", e); await prisma.$disconnect(); process.exit(1); });
