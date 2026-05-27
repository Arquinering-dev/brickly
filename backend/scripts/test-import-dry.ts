import { readFileSync } from 'fs';
import { importApuXlsx } from '../src/services/apu-import.service';

async function main() {
  const buf = readFileSync('/Users/pablopagliaricci/Downloads/APU_Unificado_GDR3760_VF.xlsx');
  const result = await importApuXlsx(buf, { dryRun: true });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error);
