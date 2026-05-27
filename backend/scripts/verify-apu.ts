import * as XLSX from 'xlsx';
import * as path from 'path';

// ─── ANSI color helpers ───────────────────────────────────────────────────────
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const C = (s: string) => `\x1b[36m${s}\x1b[0m`;

// ─── Counters ─────────────────────────────────────────────────────────────────
let errors = 0;
let warnings = 0;

function err(msg: string) {
  console.log(R(`  ❌ ERROR: ${msg}`));
  errors++;
}

function warn(msg: string) {
  console.log(Y(`  ⚠️  WARN:  ${msg}`));
  warnings++;
}

function ok(msg: string) {
  console.log(G(`  ✅ OK:    ${msg}`));
}

// ─── Sheet reader ─────────────────────────────────────────────────────────────
function getSheet(wb: XLSX.WorkBook, name: string): any[][] {
  const ws = wb.Sheets[name];
  if (!ws) {
    err(`Sheet "${name}" not found in workbook`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  return rows;
}

function cellStr(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cellNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const filePath = process.argv[2] ?? path.join(
  process.env.HOME ?? '',
  'Downloads',
  'APU_Unificado_GDR3760_VF.xlsx'
);

console.log(B('\n══════════════════════════════════════════════════'));
console.log(B('   APU Excel Verification Script'));
console.log(B('══════════════════════════════════════════════════'));
console.log(C(`  File: ${filePath}\n`));

let wb: XLSX.WorkBook;
try {
  wb = XLSX.readFile(filePath);
} catch (e: any) {
  console.log(R(`\n❌ Cannot open file: ${e.message}`));
  process.exit(1);
}

console.log(C(`  Sheets found: ${wb.SheetNames.join(', ')}\n`));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. INSUMOS CATALOG INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(B('\n─── 1. Insumos Catalog Integrity ───────────────────'));

// Combined insumo catalog: code -> sheet
const combinedInsumos = new Map<string, string>(); // code -> sheet name

// Track global duplicates across sheets
const globalCodes = new Map<string, string>(); // code -> first sheet

let matCount = 0, moCount = 0, eqCount = 0;

// ── MATERIALES ──
{
  console.log(C('\n  [MATERIALES]'));
  const rows = getSheet(wb, 'MATERIALES');
  // Find header row
  let dataRows = rows.slice(1); // skip header
  const emptyCodes: number[] = [];
  const emptyDescs: number[] = [];
  const missingUnidad: number[] = [];
  const priceWarnings: number[] = [];
  const dupWithinSheet = new Map<string, number>(); // code -> first row idx
  const dupCodes: { code: string; rows: number[] }[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // 1-based, +1 for header
    const code = cellStr(row[0]);
    const desc = cellStr(row[1]);
    const unidad = cellStr(row[2]);
    const price = cellNum(row[3]);

    if (!code) {
      emptyCodes.push(rowNum);
      return; // skip further checks for this row
    }
    if (!desc) emptyDescs.push(rowNum);
    if (!unidad) missingUnidad.push(rowNum);
    if (price !== null && price <= 0) priceWarnings.push(rowNum);

    // Within-sheet duplicate
    if (dupWithinSheet.has(code)) {
      dupCodes.push({ code, rows: [dupWithinSheet.get(code)!, rowNum] });
    } else {
      dupWithinSheet.set(code, rowNum);
    }

    // Cross-sheet duplicate
    if (globalCodes.has(code)) {
      err(`Code "${code}" (row ${rowNum} in MATERIALES) already exists in sheet "${globalCodes.get(code)}"`);
    } else {
      globalCodes.set(code, 'MATERIALES');
      combinedInsumos.set(code, 'MATERIALES');
    }
    matCount++;
  });

  if (emptyCodes.length) err(`Empty codes in rows: ${emptyCodes.join(', ')}`);
  else ok('No empty codes');
  if (emptyDescs.length) err(`Empty descriptions in rows: ${emptyDescs.join(', ')}`);
  else ok('No empty descriptions');
  if (missingUnidad.length) warn(`Missing unidad in rows: ${missingUnidad.join(', ')}`);
  else ok('All rows have unidad');
  if (priceWarnings.length) warn(`Price <= 0 in rows: ${priceWarnings.join(', ')}`);
  else ok('All prices > 0');
  if (dupCodes.length) {
    dupCodes.forEach(d => err(`Duplicate code "${d.code}" within MATERIALES at rows: ${d.rows.join(', ')}`));
  } else {
    ok('No duplicate codes within sheet');
  }
  console.log(`    Total rows: ${matCount}`);
}

// ── MANO_DE_OBRA ──
{
  console.log(C('\n  [MANO_DE_OBRA]'));
  const rows = getSheet(wb, 'MANO_DE_OBRA');
  let dataRows = rows.slice(1);
  const emptyCodes: number[] = [];
  const emptyDescs: number[] = [];
  const priceWarnings: number[] = [];
  const dupWithinSheet = new Map<string, number>();
  const dupCodes: { code: string; rows: number[] }[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2;
    const code = cellStr(row[0]);
    const desc = cellStr(row[1]);
    const salary = cellNum(row[2]);

    if (!code) { emptyCodes.push(rowNum); return; }
    if (!desc) emptyDescs.push(rowNum);
    if (salary !== null && salary <= 0) priceWarnings.push(rowNum);

    if (dupWithinSheet.has(code)) {
      dupCodes.push({ code, rows: [dupWithinSheet.get(code)!, rowNum] });
    } else {
      dupWithinSheet.set(code, rowNum);
    }

    if (globalCodes.has(code)) {
      err(`Code "${code}" (row ${rowNum} in MANO_DE_OBRA) already exists in sheet "${globalCodes.get(code)}"`);
    } else {
      globalCodes.set(code, 'MANO_DE_OBRA');
      combinedInsumos.set(code, 'MANO_DE_OBRA');
    }
    moCount++;
  });

  if (emptyCodes.length) err(`Empty codes in rows: ${emptyCodes.join(', ')}`);
  else ok('No empty codes');
  if (emptyDescs.length) err(`Empty descriptions in rows: ${emptyDescs.join(', ')}`);
  else ok('No empty descriptions');
  if (priceWarnings.length) warn(`Salary/price <= 0 in rows: ${priceWarnings.join(', ')}`);
  else ok('All salaries > 0');
  if (dupCodes.length) {
    dupCodes.forEach(d => err(`Duplicate code "${d.code}" within MANO_DE_OBRA at rows: ${d.rows.join(', ')}`));
  } else {
    ok('No duplicate codes within sheet');
  }
  console.log(`    Total rows: ${moCount}`);
}

// ── EQUIPOS ──
{
  console.log(C('\n  [EQUIPOS]'));
  const rows = getSheet(wb, 'EQUIPOS');
  let dataRows = rows.slice(1);
  const emptyCodes: number[] = [];
  const emptyDescs: number[] = [];
  const priceWarnings: number[] = [];
  const dupWithinSheet = new Map<string, number>();
  const dupCodes: { code: string; rows: number[] }[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2;
    const code = cellStr(row[0]);
    const desc = cellStr(row[1]);
    const costoTotal = cellNum(row[2]);

    if (!code) { emptyCodes.push(rowNum); return; }
    if (!desc) emptyDescs.push(rowNum);
    if (costoTotal !== null && costoTotal <= 0) priceWarnings.push(rowNum);

    if (dupWithinSheet.has(code)) {
      dupCodes.push({ code, rows: [dupWithinSheet.get(code)!, rowNum] });
    } else {
      dupWithinSheet.set(code, rowNum);
    }

    if (globalCodes.has(code)) {
      err(`Code "${code}" (row ${rowNum} in EQUIPOS) already exists in sheet "${globalCodes.get(code)}"`);
    } else {
      globalCodes.set(code, 'EQUIPOS');
      combinedInsumos.set(code, 'EQUIPOS');
    }
    eqCount++;
  });

  if (emptyCodes.length) err(`Empty codes in rows: ${emptyCodes.join(', ')}`);
  else ok('No empty codes');
  if (emptyDescs.length) err(`Empty descriptions in rows: ${emptyDescs.join(', ')}`);
  else ok('No empty descriptions');
  if (priceWarnings.length) warn(`Costo Total <= 0 in rows: ${priceWarnings.join(', ')}`);
  else ok('All costs > 0');
  if (dupCodes.length) {
    dupCodes.forEach(d => err(`Duplicate code "${d.code}" within EQUIPOS at rows: ${d.rows.join(', ')}`));
  } else {
    ok('No duplicate codes within sheet');
  }
  console.log(`    Total rows: ${eqCount}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PARTIDAS INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(B('\n─── 2. Partidas Integrity ──────────────────────────'));

const partidaCodes = new Map<string, { rowNum: number; numComp: number | null }>(); // code -> {rowNum, numComp}
let partidaCount = 0;

{
  console.log(C('\n  [PARTIDAS]'));
  const rows = getSheet(wb, 'PARTIDAS');
  let dataRows = rows.slice(1);
  const emptyCodes: number[] = [];
  const emptyDescs: number[] = [];
  const missingRubro: number[] = [];
  const rendWarnings: number[] = [];
  const dupCodes: { code: string; rows: number[] }[] = [];
  const dupWithin = new Map<string, number>();

  dataRows.forEach((row, i) => {
    const rowNum = i + 2;
    const code = cellStr(row[0]);
    const desc = cellStr(row[3]);
    const rubro = cellStr(row[2]);
    const rend = cellNum(row[5]);
    // # Comp. is at index 16
    const numComp = cellNum(row[16]);

    if (!code) { emptyCodes.push(rowNum); return; }
    if (!desc) emptyDescs.push(rowNum);
    if (!rubro) missingRubro.push(rowNum);
    if (rend !== null && rend <= 0) rendWarnings.push(rowNum);

    if (dupWithin.has(code)) {
      dupCodes.push({ code, rows: [dupWithin.get(code)!, rowNum] });
    } else {
      dupWithin.set(code, rowNum);
    }

    partidaCodes.set(code, { rowNum, numComp: numComp });
    partidaCount++;
  });

  if (emptyCodes.length) err(`Empty codes in rows: ${emptyCodes.join(', ')}`);
  else ok('No empty codes');
  if (emptyDescs.length) err(`Empty descriptions in rows: ${emptyDescs.join(', ')}`);
  else ok('No empty descriptions');
  if (missingRubro.length) warn(`Missing rubro in rows: ${missingRubro.join(', ')}`);
  else ok('All partidas have rubro');
  if (rendWarnings.length) warn(`Rendimiento <= 0 in rows: ${rendWarnings.join(', ')}`);
  else ok('All rendimientos > 0');
  if (dupCodes.length) {
    dupCodes.forEach(d => err(`Duplicate code "${d.code}" within PARTIDAS at rows: ${d.rows.join(', ')}`));
  } else {
    ok('No duplicate codes within PARTIDAS');
  }
  console.log(`    Total rows: ${partidaCount}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. COMPOSICIÓN INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(B('\n─── 3. Composición Integrity ───────────────────────'));

const VALID_TIPOS = new Set(['MAT', 'MO', 'EQ', 'SUBCONTRATO']);
let compCount = 0;

// Map: partida_code -> actual count of composition rows
const compCountByPartida = new Map<string, number>();

{
  console.log(C('\n  [COMPOSICIÓN]'));
  const rows = getSheet(wb, 'COMPOSICIÓN');
  let dataRows = rows.slice(1);

  const missingPartidaRows: number[] = [];
  const missingInsumoRows: { rowNum: number; code: string; tipo: string }[] = [];
  const invalidTipos: { rowNum: number; tipo: string }[] = [];
  const cantWarnings: number[] = [];
  const despErrors: number[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2;
    // COMPOSICIÓN: [Partida, Tipo, Subtipo, Cod_Insumo, Descripción, Cant, %Desp, Precio, Costo, Clave, Count, Clave2]
    const partida = cellStr(row[0]);
    const tipo = cellStr(row[1]);
    const codInsumo = cellStr(row[3]);
    const cant = cellNum(row[5]);
    const desp = cellNum(row[6]);

    if (!partida) return; // skip blank rows

    compCount++;

    // Track actual comp count per partida
    compCountByPartida.set(partida, (compCountByPartida.get(partida) ?? 0) + 1);

    // Partida must exist in PARTIDAS
    if (!partidaCodes.has(partida)) {
      missingPartidaRows.push(rowNum);
    }

    // Tipo validation
    if (!VALID_TIPOS.has(tipo)) {
      invalidTipos.push({ rowNum, tipo });
    }

    // Cod_Insumo must exist in combined catalog (skip SUBCONTRATO rows — they may reference a different sheet)
    if (tipo !== 'SUBCONTRATO' && codInsumo) {
      if (!combinedInsumos.has(codInsumo)) {
        missingInsumoRows.push({ rowNum, code: codInsumo, tipo });
      }
    }

    // Cant <= 0 warning
    if (cant !== null && cant <= 0) cantWarnings.push(rowNum);

    // %Desp < 0 error
    if (desp !== null && desp < 0) despErrors.push(rowNum);
  });

  // Report
  if (missingPartidaRows.length) {
    // Show first 20
    const sample = missingPartidaRows.slice(0, 20).join(', ');
    const more = missingPartidaRows.length > 20 ? ` ... (+${missingPartidaRows.length - 20} more)` : '';
    err(`Partida code not found in PARTIDAS — rows: ${sample}${more}`);
  } else {
    ok('All composición partida codes exist in PARTIDAS');
  }

  if (missingInsumoRows.length) {
    // Group by code for cleaner output
    const byCode = new Map<string, number[]>();
    missingInsumoRows.forEach(({ rowNum, code }) => {
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code)!.push(rowNum);
    });
    let shown = 0;
    byCode.forEach((rowNums, code) => {
      if (shown < 15) {
        err(`Cod_Insumo "${code}" not found in catalog — rows: ${rowNums.slice(0, 5).join(', ')}${rowNums.length > 5 ? '...' : ''}`);
        shown++;
      }
    });
    if (byCode.size > 15) {
      err(`... and ${byCode.size - 15} more missing insumo codes (total ${missingInsumoRows.length} rows)`);
    }
  } else {
    ok('All Cod_Insumo references exist in combined catalog');
  }

  if (invalidTipos.length) {
    const sample = invalidTipos.slice(0, 10).map(x => `row ${x.rowNum}: "${x.tipo}"`).join(', ');
    const more = invalidTipos.length > 10 ? ` (+${invalidTipos.length - 10} more)` : '';
    err(`Invalid Tipo values — ${sample}${more}`);
  } else {
    ok('All Tipo values are valid (MAT/MO/EQ/SUBCONTRATO)');
  }

  if (cantWarnings.length) {
    const sample = cantWarnings.slice(0, 20).join(', ');
    warn(`Cant <= 0 in rows: ${sample}${cantWarnings.length > 20 ? ` (+${cantWarnings.length - 20} more)` : ''}`);
  } else {
    ok('All Cant > 0');
  }

  if (despErrors.length) {
    const sample = despErrors.slice(0, 20).join(', ');
    err(`%Desp < 0 in rows: ${sample}${despErrors.length > 20 ? ` (+${despErrors.length - 20} more)` : ''}`);
  } else {
    ok('All %Desp >= 0');
  }

  console.log(`    Total rows processed: ${compCount}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CROSS-CHECK: # Comp. field vs actual COMPOSICIÓN counts
// ═══════════════════════════════════════════════════════════════════════════════
console.log(B('\n─── 4. Cross-check # Comp. field ───────────────────'));

{
  let mismatchCount = 0;
  let nullCompCount = 0;

  partidaCodes.forEach(({ rowNum, numComp }, code) => {
    const actual = compCountByPartida.get(code) ?? 0;

    if (numComp === null) {
      // No # Comp. declared — just note if there ARE comp rows
      if (actual > 0) {
        warn(`Partida "${code}" (row ${rowNum}): # Comp. is empty but has ${actual} composición rows`);
        nullCompCount++;
      }
      return;
    }

    if (numComp !== actual) {
      warn(`Partida "${code}" (row ${rowNum}): # Comp. says ${numComp} but found ${actual} composición rows`);
      mismatchCount++;
    }
  });

  // Also check for composición rows referencing partidas with no # Comp. set
  compCountByPartida.forEach((actual, code) => {
    if (!partidaCodes.has(code)) return; // already reported above
  });

  if (mismatchCount === 0 && nullCompCount === 0) {
    ok('All # Comp. values match actual composición row counts');
  } else {
    if (mismatchCount > 0) console.log(Y(`  ⚠️  ${mismatchCount} partidas have mismatched # Comp. counts`));
    if (nullCompCount > 0) console.log(Y(`  ⚠️  ${nullCompCount} partidas have null # Comp. but have composición rows`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(B('\n══════════════════════════════════════════════════'));
console.log(B('   SUMMARY'));
console.log(B('══════════════════════════════════════════════════'));
console.log(`  Insumos catalog:`);
console.log(`    Materiales : ${matCount}`);
console.log(`    Mano de obra: ${moCount}`);
console.log(`    Equipos    : ${eqCount}`);
console.log(`    Total      : ${matCount + moCount + eqCount}`);
console.log(`  Partidas     : ${partidaCount}`);
console.log(`  Composición  : ${compCount} rows`);
console.log('');

if (errors > 0) {
  console.log(R(`  ❌ ${errors} error(s) found`));
} else {
  console.log(G(`  ❌ 0 errors`));
}

if (warnings > 0) {
  console.log(Y(`  ⚠️  ${warnings} warning(s) found`));
} else {
  console.log(G(`  ⚠️  0 warnings`));
}

console.log('');
if (errors === 0) {
  console.log(G('  ✅ Ready to import — no blocking errors'));
} else {
  console.log(R(`  ❌ Fix ${errors} error(s) before importing`));
}

console.log(B('══════════════════════════════════════════════════\n'));

process.exit(errors > 0 ? 1 : 0);
