"""
Genera docs/Decisiones_Composicion_SVD4140.md — todas las decisiones/dudas tomadas al armar
la composición de cada tarea del APU Unificado SVD, ordenado por tarea, para que Pedro valide.
"""
import json, os, re, warnings, openpyxl
warnings.filterwarnings('ignore')

SCRATCH = os.environ.get('SCRATCH', '.')
bud = json.load(open(os.path.join(SCRATCH, 'budget_parsed.json'), encoding='utf-8'))
apu = json.load(open(os.path.join(SCRATCH, 'apu_parsed.json'), encoding='utf-8'))
apu_by_num = {}
for p in apu['partidas']:
    m = re.match(r'\s*(\d+)', str(p['partida']))
    if m:
        apu_by_num.setdefault(int(m.group(1)), p)

PRES = 'archivos/fuente/El Salvador_Pres 04 (sin pintura).xlsx'
wf = openpyxl.load_workbook(PRES)['01']
wv = openpyxl.load_workbook(PRES, data_only=True)['01']
# nombres de rubro
RUB = {}
for r in range(8, wv.max_row + 1):
    a = wv.cell(r, 1).value
    if isinstance(a, (int, float)) and float(a) == int(a):
        RUB[int(a)] = re.sub(r'\s+', ' ', str(wv.cell(r, 3).value or '')).strip()
# fila de '01' por item (nº puede ser formula -> leer de valores)
row_of = {}
for r in range(8, wv.max_row + 1):
    a = wv.cell(r, 1).value
    if isinstance(a, (int, float)) and float(a) != int(a):
        row_of[round(a, 4)] = r

def f01(item, col):
    r = row_of.get(round(item, 4))
    return wf.cell(r, col).value if r else None

def unscaled_apu(pnum, tipo):
    p = apu_by_num.get(pnum)
    if not p:
        return 0
    if tipo == 'MAT':
        return sum((m['cant'] or 0) * (m['precio'] or 0) * (1 + (m['desp'] or 0)) for m in p['materiales']) + (p['consumibles_total'] or 0)
    rend = p['rend'] or 1
    if tipo == 'MO':
        return (p['grado'] or 1) * sum((x['cant'] or 0) * (x['precio'] or 0) for x in p['mo']) / rend
    return sum((x['cant'] or 0) * (x['precio'] or 0) for x in p['equipos']) / rend

flags = {(f[0]): f for f in bud['flags']}

def decide(it):
    """Devuelve (lista_decisiones, lista_validar) para un item."""
    desc = it['desc']; route = it['route']
    tgt = (it['tgt_mat'] or 0) + (it['tgt_mo'] or 0) + (it['tgt_eq'] or 0)
    dec, val = [], []
    # excluida
    if tgt < 1:
        if 15 <= it['item'] < 16:
            dec.append('**Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.')
        elif 'no cotiza' in desc.lower() or 'comitente' in desc.lower():
            dec.append('Sin costo (no cotiza / provisión a cargo del comitente).')
        else:
            dec.append('Costo 0 en el presupuesto (cantidad 0 o no cotizado).')
        return dec, val
    # fuentes
    fuentes = [r['fuente'] for r in it['rows']]
    apu_parts = sorted({f.split('APU P-')[1] for f in fuentes if f.startswith('APU P-')}, key=int)
    mo_alb = [r for r in it['rows'] if r['tipo'] == 'MO' and r['subtipo'] == 'ALB']
    mo_otr = [r for r in it['rows'] if r['tipo'] == 'MO' and r['subtipo'] == 'OTR']
    lumps = [r for r in it['rows'] if r['fuente'] == 'lump']
    aux = sorted({f.split('aux:')[1] for f in fuentes if f.startswith('aux:')} |
                 {f for f in fuentes if f in ('ELECT', 'COVE', 'CALEFA', 'INCEND', 'ENCOFRADO', 'GGBB')})
    # ruta principal
    if route == 'APU' and apu_parts:
        pn = int(apu_parts[0])
        uns = unscaled_apu(pn, 'MAT')
        fac = (it['tgt_mat'] / uns) if uns else 1
        if abs(fac - 1) < 0.02:
            dec.append(f'Composición tomada **completa del APU P-{pn}** (Δ vs presupuesto {pct(it)}).')
        else:
            dec.append(f'Composición del **APU P-{pn} escalada ×{fac:.3f}** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ {pct(it)}.')
    elif route == 'Tareas':
        dec.append(f'Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ {pct(it)}.')
    else:  # directo
        srcs = []
        if any(f == 'Cotizaciones' for f in fuentes): srcs.append('Cotizaciones')
        if any(f == 'SUBCONTRATOS' for f in fuentes): srcs.append('SUBCONTRATOS')
        if aux: srcs.append('hojas auxiliares (' + ', '.join(aux) + ')')
        if any(f == 'P.MO 09.24' for f in fuentes): srcs.append('jornales P.MO')
        if srcs:
            dec.append('Resuelto directo desde: ' + ', '.join(srcs) + f'. Δ {pct(it)}.')
        else:
            dec.append(f'Resuelto directo. Δ {pct(it)}.')
    # MO/OTR subcontratos
    if mo_otr:
        nm = ', '.join(sorted({r['desc'][:40] for r in mo_otr})[:4])
        dec.append(f'MO subcontratada (OTR): {nm}.')
    # aux 1-unit
    if aux:
        dec.append(f'Expandido de hoja(s) auxiliar(es) {", ".join(aux)} — se asume costo de **1 unidad** (confirmado por vos).')
    # lumps (NOTA informativa, no es una duda: el presupuesto no deja rastro de insumos;
    # se usó el valor presupuestado como una sola línea — fiel al monto)
    if lumps:
        ln = ', '.join(sorted({r['desc'][:34] for r in lumps})[:3])
        dec.append(f'_Nota: costo sin desglose de insumos (valor del presupuesto como una línea): {ln}._')
    # ALB/OTR dudoso (jefe/coord/topografo) -> VALIDAR
    for r in mo_alb:
        if r['desc'] in ('JEFE DE OBRA', 'COORD OBRAS', 'SOBRESTANTE'):
            dec.append(f'⚠ **{r["desc"]}** quedó como MO/ALB (nómina) por trazabilidad (→P.MO), pero es gestión/indirecta. **Validar si va OTR.**')
            val.append(f'{r["desc"]} ALB vs OTR')
    # baños quimicos -> deberia OTR -> VALIDAR
    if 'quimicos' in desc.lower() or 'químicos' in desc.lower():
        if mo_alb:
            dec.append('⚠ La MO de este alquiler quedó como ALB pero es un **alquiler/subcontrato → debería ser OTR** (caso clásico del manual).')
            val.append('alquiler clasificado ALB')
    # hormigón AING priced per m3 (NOTA: confirmado AING=ALB; solo limitación de horas)
    if any('H30' in r['desc'] or 'H.A' in r['desc'] or 'HA.' in r['desc'] for r in mo_alb):
        dec.append('_Nota: MO de hormigón = cuadrilla propia AING (nómina, ALB confirmado) priceada por m³, no por jornal → no da horas UOCRA directas (vendrían de 2_Quincenas)._')
    # scaled
    if desc in flags and flags[desc][2] == 'scaled':
        dec.append(f'⚠ **{flags[desc][1]}** — la fuente tiene un quirk en su propio armado; la composición se escaló al monto presupuestado preservando ítems y proporciones. **Validar el monto del presupuesto.**')
        val.append('escalado por quirk de fuente')
    # item con nº de formula
    if round(it['item'], 2) in (12.01, 14.01, 14.02, 17.01, 18.01):
        dec.append('(Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)')
    return dec, val

def pct(it):
    t = (it['tgt_mat'] or 0) + (it['tgt_mo'] or 0)
    r = (it['rec_mat'] or 0) + (it['rec_mo'] or 0)
    if not t:
        return '0%'
    return f'{(r/t-1)*100:+.1f}%'

# ---------- construir doc ----------
items = sorted(bud['items'], key=lambda x: x['item'])
L = []
L.append('# Decisiones y dudas — Composición del APU Unificado SVD 4140')
L.append('')
L.append('> Documento para validar antes de integrar la COMPOSICIÓN al Resumen v8.')
L.append('> Cada tarea muestra de dónde se reconstruyó su composición y qué decisiones se tomaron.')
L.append('> El **Δ** es la diferencia del costo reconstruido vs el del presupuesto (0% = exacto).')
L.append('> Las marcas **⚠** señalan decisiones que conviene que confirmes.')
L.append('')
L.append('## A. Reglas transversales (aplican a todas las tareas)')
L.append('')
L.append('1. **Trazabilidad antes que paridad** (manual v3): se reconstruye cada insumo individual; '
         'solo se usa *lump* cuando el presupuesto no deja rastro.')
L.append('2. **ALB vs OTR por trazabilidad** (confirmado por vos): MO que llega a `P.MO`/`MO HA AING` '
         '= ALB (nómina propia); a `SUBCONTRATOS`/`MO HA SILVA` = OTR (subcontrato).')
L.append('3. **Caso 7 (partidas derivadas)**: cuando el presupuesto usa una fracción de una partida APU '
         '(p.ej. distinto espesor), el factor se aplica a las **cantidades** de los insumos, no a los precios.')
L.append('4. **Hojas auxiliares** (ELECT, COVE, CALEFA, INCEND): se asume costo **de 1 unidad** (confirmado por vos).')
L.append('5. **Desperdicio** de materiales: se deriva del total real del APU (el APU mezcla % entero y fracción).')
L.append('6. **Consumibles**: el `MAT-CONS` (precio 1) es solo para los consumibles % del APU; las líneas '
         '"Consumibles" de Tareas son un costo real con su precio.')
L.append('7. **Pintura excluida**: el presupuesto es "sin pintura" → rubro 15 con costo 0.')
L.append('8. **Equipos**: 13 partidas del APU tienen el equipo con VLOOKUP roto (`#N/A`); ese costo de '
         'equipo no se pudo reconstruir (EQ está excluido del control de costos igual).')
L.append('9. **Hormigón estructural (rubro 3)**: la MO la hace la cuadrilla propia AING (nómina = ALB, '
         'confirmado por vos) pero está priceada **por m³**, no por jornal → su costo es correcto pero '
         'no se descompone a horas UOCRA directas (esas saldrían de `2_Quincenas`). El hormigón en sí '
         '(H30 premezclado) va como una línea de material (se compra como unidad, no se desglosa).')
L.append('10. **Lump (sin desglose)**: cuando el presupuesto carga un valor pegado sin rastro de insumos '
         '(subcontrato global, premezclado, colocación a cargo del comitente), se usa ese valor como una '
         'sola línea — **fiel al monto presupuestado**, pero sin detalle de insumos. No es un error; se '
         'listan en la sección B2 por transparencia.')
L.append('')

# B. validaciones
val_items = []
dec_cache = {}
for it in items:
    dec, val = decide(it)
    dec_cache[it['item']] = (dec, val)
    if val:
        val_items.append((it, val))
L.append(f'## B. Tareas que requieren tu validación ⚠ ({len(val_items)})')
L.append('')
L.append('| Tarea | Descripción | A validar |')
L.append('|---|---|---|')
for it, val in val_items:
    L.append(f"| **{it['item']:g}** | {it['desc'][:48]} | {'; '.join(val)} |")
L.append('')

# B2. lumps (informativo)
lump_items = [it for it in items if any(r['fuente'] == 'lump' for r in it['rows'])
              and ((it['tgt_mat'] or 0) + (it['tgt_mo'] or 0) + (it['tgt_eq'] or 0)) >= 1]
L.append(f'## B2. Tareas sin desglose de insumos / lump ({len(lump_items)}) — informativo')
L.append('')
L.append('Costo fiel al presupuesto pero como una sola línea (sin insumos individuales). '
         'Típicamente: subcontrato global, hormigón premezclado, o colocación con material del comitente.')
L.append('')
L.append('| Tarea | Descripción | Qué quedó como lump |')
L.append('|---|---|---|')
for it in lump_items:
    lr = sorted({f"{r['tipo']}/{r['subtipo']}" for r in it['rows'] if r['fuente'] == 'lump'})
    L.append(f"| {it['item']:g} | {it['desc'][:46]} | {', '.join(lr)} |")
L.append('')

# C. detalle por rubro
L.append('## C. Detalle por tarea (las 189)')
last_rub = None
for it in items:
    rub = int(it['item'])
    if rub != last_rub:
        L.append('')
        L.append(f'### Rubro {rub} — {RUB.get(rub, "")}')
        last_rub = rub
    dec, val = dec_cache[it['item']]
    mark = ' ⚠' if val else ''
    L.append(f"- **{it['item']:g} {it['desc'][:60]}**{mark}")
    for dd in dec:
        L.append(f'  - {dd}')

open('docs/Decisiones_Composicion_SVD4140.md', 'w', encoding='utf-8').write('\n'.join(L))
print('OK -> docs/Decisiones_Composicion_SVD4140.md')
print(f'Tareas: {len(items)} | con validación pendiente: {len(val_items)}')
