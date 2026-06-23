import { readFileSync } from 'fs';
import { importResumenXlsx } from '../src/services/resumen-import.service';

// Dry-run del importador del Resumen de Obra. Pasá la ruta del .xlsx como argumento:
//   npx tsx scripts/test-import-dry.ts /ruta/al/CH_2171_Resumen_de_Obra.xlsx
async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Uso: npx tsx scripts/test-import-dry.ts <ruta-al-resumen.xlsx>');
    process.exit(1);
  }
  const buf = readFileSync(path);
  const result = await importResumenXlsx(buf, { dryRun: true, filename: path.split('/').pop() });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error);
