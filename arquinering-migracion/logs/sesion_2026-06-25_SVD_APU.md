# Sesión 2026-06-25 — APU Unificado SVD 4140 (Bloques 1–2)

### Objetivo
Construir el APU Unificado de SVD 4140 para obtener la hoja `Composición` (detalle de
insumos presupuestados por tarea: control de presupuesto + control de horas MO interna).
Metodología: `docs/APU_Unificado_Manual_Tecnico_v3.docx` (8 casos + 7 reglas).

### Fuentes (subidas por Pedro a archivos/fuente/)
- `El Salvador_Pres 04 (sin pintura).xlsx` — presupuesto entero, con **fórmulas vivas**
  (`01`, `Tareas`, índice `APU 09.24`, `Cotizaciones`, `SUBCONTRATOS`, `P.MO 09.24`,
  auxiliares ELECT/COVE/CALEFA/INCEND/ENCOFRADO/Mampostería/Locales, cuadrillas
  `MO HA AING`=nómina propia/ALB y `MO HA SILVA`=subcontrato/OTR).
- `ARQING - APU 09-24.xlsx` — APU de la fecha de cotización (87 hojas, P-32…P-146).

### Decisiones confirmadas con Pedro
1. **SILVA = OTR** (subcontrato), **AING = ALB** (nómina propia hormigón).
2. ALB vs OTR de instalaciones se resuelve **por trazabilidad** (→`P.MO`/`MO HA AING`=ALB;
   →`SUBCONTRATOS`/`MO HA SILVA`=OTR); dudas a `pendientes.md`.
3. Hojas auxiliares expresan costo **de 1 unidad** salvo aviso.
4. Nivel objetivo: **detalle insumo-por-insumo** (máximo del manual).

### Completado
- [x] **Bloque 1 — Parseo APU** (`scripts/svd_apu_parser.py` → `apu_parsed.json`):
  125 materiales, 19 categorías MO UOCRA, 53 subcontratos, **78 partidas P-XX**, 0 errores.
  Composición reconcilia con CD del APU: **57/58 Δ<1%**. Regla 5 (sumar repetidos) y mapeo
  por descripción (P-70 MEMB001) OK. Desperdicio derivado del total real `G` (el APU mezcla
  entero-% y fracción). Anomalías = **bugs del propio APU**, manejadas: P-114 `Total Materiales`
  excluye 6 materiales menores (bug A.1, Δ+8,3% → OBSERVACIONES); 13 partidas con equipo `#N/A`
  (VLOOKUP roto) flageadas (EQ está excluido del control).
- [x] **Bloque 2 — Parseo presupuesto + composición** (`scripts/svd_pres_parser.py` →
  `budget_parsed.json`): 184 ítems, **912 filas de composición**. Rutas: APU 52, Tareas 30,
  directo 102. Resolver general por evaluación-atribución (multi-término + coeficientes +
  Caso 7 factores por tipo + selectividad de columnas Tareas).
  - **Reconciliación: MAT 1/184 >1% (4.03 en 1,0% exacto, redondeo APU), MO 0/184.**
  - **Agregado: composición = costo directo del presupuesto EXACTO = $1.187.292.786, 0 divergencias.**
  - MO/ALB desglosado por categoría UOCRA (control de horas) ✓.
  - 13 ítems sin composición = todos **costo cero** ("No cotiza", demoliciones E=0).

### Flags para revisar (a pendientes.md)
- `[ALB/OTR?]` Topógrafo (1.02) priceado con jornal JEFE DE OBRA vía `P.MO` → quedó MO/ALB por
  trazabilidad; gestión/indirecta, confirmar si va OTR.
- `[scaled]` 23.01 "parrilla completa": fuente duplica (×2) en su propio armado → composición
  escalada al total presupuestado. 1.09 "trámite luz": ×0,795. (Quirks de la fuente, no del parser.)
- 4.03 Muro tipo 4: Δ MAT 1,0% (composición real P-XX vs índice).

- [x] **Bloque 3 — Generación** (`scripts/svd_apu_unif_generar.py` →
  `archivos/output/APU_Unificado_SVD4140_v1.xlsx`): replica la estructura de los APU_Unificado
  de referencia (GDR/CH). Hojas: CONFIG · MATERIALES (199) · MANO_DE_OBRA (13) · EQUIPOS (93) ·
  SUBCONTRATOS_PRY (86) · **COMPOSICIÓN (912 filas)** · **PARTIDAS (184)** · PPTO_GENERADOR.
  Formula-pure (VLOOKUP condicional por tipo, SUMIFS, XLOOKUP `_xlfn`). PARTIDAS keyed por
  `PTO-RRII`, Rend=1 (composición ya por-unidad). MO/ALB normalizado a categoría UOCRA por
  jornal. Valores originales del presupuesto en T/U/V (auditoría Δ).
- [x] **Bloque 4 — Validación**: COM recalc + recalc.py = **0 errores de fórmula**.
  **184/184 partidas con Δ≤1,1%**; VLOOKUP resuelven todos (0 "?"); MAT-CONS=$1;
  Rend.Part/Cant MO-ALB Unit/Cant.Ej.Part computan. **Total CD = $1.187.346.706 vs presupuesto
  $1.187.292.786 (Δ 0,0045%** = desviación APU-índice documentada).

### Entregable
**`archivos/output/APU_Unificado_SVD4140_v1.xlsx`** — la hoja **COMPOSICIÓN** es la fuente de
detalle de insumos por tarea (control de presupuesto + control de horas MO interna). Pipeline
reproducible: `svd_apu_parser.py` → `svd_pres_parser.py` → `svd_apu_unif_generar.py`.

### Adenda — PPTO_GENERADOR con costos + BUG de 5 ítems (a pedido de Pedro)
Se agregaron a `PPTO_GENERADOR` (layout GDR/CH): `MAT/ud · MO/ud · EQ/ud · CD/ud` (VLOOKUP a
PARTIDAS por código) + `MAT total · MO total · EQ total · Costo Total` (=unit×Cant) + **fila
TOTAL OBRA** (SUM por tipo). Esa verificación **destapó un bug real**: el parser leía el nº de
ítem del wb de **fórmulas**, y 5 ítems lo tienen como fórmula (`=+A96+0.01`: 12.01, 14.01, 14.02,
17.01, 18.01) → quedaban **fuera** ($41,07M / 3,3%). Fix: leer nº/desc/ud del wb **data_only**.
- 189 ítems (no 184). [⚠ total provisorio de esta adenda, corregido en Adenda 2.]

### Adenda 2 — BUG "sin pintura" (rubro 15) — audita tareas 1-25 (a pedido de Pedro)
Pedro vio que `01!T216` (subtotal "OBRA GRIS", tareas 1-25) = $897.042.888 pero mi PPTO daba
$962.566.573 (+$65,5M). Auditoría por rubro: **todo el desvío era el rubro 15 = PINTURA**. El
presupuesto es "**sin pintura**": **anula las columnas de TOTAL `N-R` (costo 0) de los ítems de
pintura, dejando los unitarios `F/G/I/J/L` intactos** como referencia. Mi parser reconciliaba
contra los unitarios → metía la pintura que el presupuesto excluye.
- **Fix**: reconciliar contra las columnas de TOTAL `N/O/P/Q/R` (÷cant) = la verdad del costo
  (`S=SUM(N:R)`); manejar tgt=0 (anular composición); descartar filas con cant=0 al generar.
- **Cifras FINALES: costo directo (sin pintura) = $1.162.897.726; TOTAL del APU = $1.162.951.647
  (Δ 0,0046%).** Por rubro: 1-25=$897,1M ✓, 26=$224,1M ✓, 27+28=$41,8M ✓. COMPOSICIÓN 881 filas
  (31 de pintura descartadas). El resto ($53.921, todo rubro 4) = desviación composición-APU vs índice.
- Nota: el detalle de insumos de pintura existe en el APU (P-80/89/138…) si luego se cotiza;
  hoy el APU Unificado refleja el presupuesto = sin pintura.

### Adenda 3 — Documento de decisiones + BUG de itemización (`_eval_with`)
A pedido de Pedro se generó **`docs/Decisiones_Composicion_SVD4140.md`** (decisiones/dudas por
tarea, para validar antes de integrar). Al revisarlo se vio que **tableros 18.10-18.16 figuraban
como lump** pese a referenciar `ELECT!I5/I29/…`. Causa: en `_eval_with` las posiciones de los
refs se calculan sobre la fórmula **original** (`=+ELECT!I5`) pero la sustitución se hacía sobre
la fórmula ya recortada (sin `=+`) → desfase → `None` → **caía a lump**. Afectaba a **casi todos
los ítems "directo"** (la reconciliación pasaba igual porque el lump tiene el monto correcto,
pero se perdía el detalle de insumos). Fix: sustituir sobre la original y recortar después.
- **Resultado: COMPOSICIÓN 881→989 filas** (mucho más itemizada: ELECT/Cotizaciones/SUBCONTRATOS),
  MATERIALES 241, lumps 144→63. **Totales idénticos** (1-25=$897,1M, total=$1.162,9M, recalc 0).
- **Documento de validación: 4 dudas reales** (1.02 topógrafo ALB/OTR, 1.06 baños=OTR, 1.09 y
  23.01 escalados) + 42 tareas lump (informativo) + detalle por tarea de las 189.

### Pendiente próxima sesión
- [ ] Resolver flags de `pendientes.md` (topógrafo ALB/OTR, MO-X01 baños=OTR, categorías MO no
      estándar, 23.01/1.09 quirks de fuente) con Pedro.
- [ ] Integrar la COMPOSICIÓN al Resumen v8 de SVD (`1_Composicion`) vía join por `Cod_Item_Ppto`.

### Artefactos
- `scripts/svd_apu_parser.py`, `scripts/svd_pres_parser.py` (pipeline reproducible).
- `scripts/_apu_parse_report.txt`, `scripts/_pres_parse_report.txt` (reportes intermedios).
- JSON en scratchpad: `apu_parsed.json`, `budget_parsed.json`.


### Adenda 4 — Refinamiento por feedback de Pedro (Fases A–F)
Tras revisar el documento de decisiones, Pedro dio 5 comentarios → plan de 6 fases (no todo a la vez):
- **Fase A — reglas de clasificación**: (1) consumibles unificados a un único `MAT-CONS` (precio 1,
  cant=costo) tanto APU como Tareas; (2) **MO en columna "otro" (`Tareas!L`/`01!I`) → siempre MO/OTR**
  (topógrafo Jefe de Obra), MO/ALB solo jornales M/N/O/P y MO HA AING; (3) MO/OTR multi-término de
  P.MO **itemizada con jornales** (18.17: ESP×10 + MED×10); (4) flete/traslado → MO/OTR.
- **Fase B — MO de hormigón**: `MO HA AING` tiene bloques tipo-APU (jornales por categoría UOCRA +
  rendimiento + GG% que varía por bloque). Se descompone la MO de 9 tareas de hormigón en
  **MO/ALB con jornales reales** (1.592 jornales: OFI 794 + ESP 769 + AYU 28). Habilita control de
  horas. 3.03/3.04 usan la sección resumen = precios SILVA → **MO/OTR** (confirmado por Pedro).
  MANO_DE_OBRA: 23→10 categorías.
- **Fase C — referencias encadenadas**: `resolve_01_cell` recursivo sigue refs a otra celda `01`
  (mismo tipo → itemiza; cross-tipo/pools → lump). 17.04→P-39, 3.05/3.08 J→bloque, 4.05/4.06→APU.
  Merge de insumos repetidos por tarea. Rubro 19 (sanitaria) = pools `AD=AB×AC` por % → lump.
- **Fase D — equipos rotos**: de 13 partidas con #N/A, solo P-137 se usaba y es **pintura excluida**
  → ninguno afecta el costo. Fallback a `Rend. Equipos` agregado como red de seguridad.
- **Fase E — lumps**: 54→40. Hormigón (hierro/H°/encofrado) nombrado desde la hoja `H°A°`; los 40
  restantes son pools de sanitaria (sin datos) + literales pegados (correctamente lump).
- **Fase F — cierre**: doc regenerado (validaciones 4→2: solo 1.09 y 23.01, quirks de fuente).
- ⚠ **BUG crítico encontrado en el camino**: `_eval_with` calculaba posiciones de refs sobre la
  fórmula original pero sustituía sobre la recortada → casi todos los "directo" caían a lump
  (la reconciliación pasaba igual). Fix subió COMPOSICIÓN de 881→~990 filas.
- **Estado final**: 189 partidas, **970 filas COMPOSICIÓN**, recalc 0 errores, total **$1.162.951.649
  vs presupuesto $1.162.897.726** (Δ 0,0046%, solo rubro 4). lumps 40 (pools+literales).
  Pipeline: `svd_apu_parser.py` → `svd_pres_parser.py` → `svd_apu_unif_generar.py`;
  doc `svd_doc_decisiones.py`.


### Adenda 5 — Auditoría de producción + correcciones (2026-06-26)
Auditoría de solo lectura de `APU_Unificado_SVD4140_v1.xlsx` (8 puntos). Resultado: 1 hallazgo
🔴 + 2 🟡; el resto 🟢. La referencia mensual correcta es **APU 09-24** (no 06-25).
- **🔴 Punto 3 (clasificación MO) — CORREGIDO**: el parser tomaba TODA la composición (MAT+MO+EQ)
  de la partida APU cuando cualquier columna la referenciaba. Mal: **cada tipo de insumo se resuelve
  desde SU propia columna/fuente**, y la **MO se clasifica por la COLUMNA del `01`** (I→OTR, J→ALB),
  no por la fuente. Casos: eléctrico 18.0x (MO viene de SUBCONTRATOS col I → OTR, no del APU);
  cielorrasos 14.0x (MO del APU pero col I → OTR). Fix: eliminada la "ruta APU" entera → resolución
  POR COLUMNA vía `resolve_01_cell` (que ya maneja APU índice/SUBCONTRATOS/encadenados); override
  `subtipo = columna` para toda MO excepto `MO HA AING` (hormigón nómina, ALB). Movió ~$46,4M de
  ALB→OTR en 20 tareas. Reconciliación **mejoró** (MAT 0/189, MO 0/189; total Δ $53.923→$15).
- **🟡 Punto 5 — naming**: (b) **ESPECIALIZADO se mantiene** (es categoría UOCRA real, está en
  quincenas) → flag retirado. (a) **Etapas canónicas** definidas (Title Case + tildes) por nº de
  rubro en el generador (track ETAPAS, distinto de rubros↔plan de cuentas). Tabla de 28 aplicada.
- **🟢 Resto**: estructura (8 hojas, 0 huérfanos), formula-pure (0 errores, 0 macros), cierre
  COMPOSICIÓN↔PARTIDAS (delta 0), conciliación (189=189, 0 dup/faltantes), precios vs **APU 09-24**
  (MAT 49/49, MO 4/4, EQ ok — sin arrastre de otro mes), colores (estándar proyecto).
- **⏳ Caso borde 7.03 "Buña en revoque"**: MO en col J (albañil) pero referencia SUBCONTRATOS. Por
  regla estricta de columna quedó **MO/ALB**, lo que metió "Buña en revoque" como categoría en
  MANO_DE_OBRA (no-UOCRA). A confirmar con Pedro si va OTR (la fuente es subcontrato).
- Script de auditoría reproducible: `scripts/audit_precios_svd.py` (precios vs 09-24).


### Adenda 6 — Integración COMPOSICIÓN → Resumen v8 `1_Composicion` (2026-06-26)
Poblada `SVD_4140_Resumen_de_Obra_v8_2.xlsx!1_Composicion` (vacía) con la COMPOSICIÓN del APU
Unificado. Script: `scripts/svd_integrar_composicion.py`. Backup: `_bak_SVD_v8_2_pre_composicion.xlsx`.
- 19 cols (igual CH): A-P de la COMPOSICIÓN + Q (Cant MO/ALB Total=O*P) + R (Cod_Item_Ppto=código
  float, clave de join) + S (Rubro=XLOOKUP a `1_Presupuesto` col D, igual fórmula que CH).
- **981 filas; 954 matchean `1_Presupuesto`; 27 huérfanos** (rubros 26-28 + partidos 2.01/24.10),
  por diseño (Resumen = obra gris 1-25; el dato 26-28 queda guardado). Recalc 0.
- **Corrección a un hallazgo previo**: 2.01 NO faltaba — está **partido** en `2.01.01`+`2.01.02`
  (códigos string; idem 24.10 → 24.10.01/02). Son 4 filas partidas (regla de los 4 rubros). NO se
  agregó nada a `1_Presupuesto`.
- **Diferido (no ejecutado)**: alinear el split MO/OTR-ALB de `1_Presupuesto` (85 tareas) al de la
  composición auditada. Razones: (1) el criterio MO es **provisorio** (pendiente Arquinering); (2)
  cambiar K/L cascadea a los rubros C/D (regla 4 rubros) y al split de venta P/Q. Síntoma visible:
  la col S de `1_Composicion` devuelve "-" donde `1_Presupuesto` no tiene rubro MO/ALB asignado
  (clasificó la MO como todo OTR). Se resuelve cuando se alinee `1_Presupuesto` (tras Arquinering).


### Adenda 7 — Alineación split MO de 1_Presupuesto (2026-06-26)
A pedido de Pedro, se alineó el split MO/OTR–ALB de `1_Presupuesto` al criterio auditado de la
composición (provisorio, pendiente Arquinering). Script: `scripts/svd_alinear_presupuesto_mo.py`.
- **86 tareas single-row** re-repartidas: K (MO/OTR) y L (MO/ALB) según composición, **preservando
  el total K+L** (N intacto). El rubro de etapa MO (único por tarea, 0 tareas con 2 rubros) se mueve
  entre col C (Rubro MO/OTR) y D (Rubro MO/ALB) según qué porción quede >0. Venta P/Q se recalcula
  sola (fórmulas). Filas partidas (2.01.01/02, 24.10.01/02) y MT/EQ no se tocaron.
- **Verificado**: MO/OTR presup=composición=$356.656.303 (Δ0); MO/ALB $277.272.237 (Δ$2 redondeo);
  costo obra gris **$897.042.888 idéntico** (0_CONFIG sin cambios); **0 rubros fuera del plan**;
  recalc 0. `1_Composicion` col S (Rubro MO/ALB vía XLOOKUP) ahora resuelve en las tareas con ALB.
- Estado: Resumen v8 SVD con `1_Composicion` poblada + `1_Presupuesto` MO consistente. La regla
  MO sigue provisoria → al cerrar criterio con Arquinering, re-correr parser+integración+alineación
  (pipeline reproducible). Backup pre-cambios: `_bak_SVD_v8_2_pre_composicion.xlsx`.


### Adenda 8 — Revisión dashboard SVD: 2 dudas de Pedro (2026-06-26)
Pedro revisó el dashboard sobre el Resumen actualizado. Evaluado:
- **Sin horas presupuestadas en MO UOCRA → BUG (mío), CORREGIDO.** `1_Composicion` col S quedó con
  header "MO/ALB" (heredado del placeholder SVD), pero el reader (`read_obra._jornales`) busca un
  header con "rubro" para armar los jornales → descartaba todo → 0 horas. Fix: header S → "Rubro"
  (como CH) en `svd_integrar_composicion.py`. Resultado: **horas_ppto = 32.757h** (antes 0),
  desglosadas por rubro/categoría UOCRA (Albañilería 14.638h, Hormigón 13.461h, etc.). Afectaba
  TODOS los rubros. Recalc 0.
- **Drill de rubro muestra solo MO (no MAT/EQ) → POR DISEÑO, no bug.** El drill es **por tipo**
  (MT→MAT, MO→MO); el MAT de 1.02 (Consumibles $125k) SÍ aparece en el drill "Preliminares **MT**".
  El **EQ se excluye** del costo controlable (decisión 2026-06-13). Cada tipo reconcilia (comp_ok=True).
  Lo que no cierra contra el presupuesto total es el EQ ($21M), excluido a propósito. Si se quiere
  mostrar el EQ en el drill (informativo) o la composición completa por tarea, es una decisión de
  diseño del dashboard (consultar). El reader no tiene bug acá.


### Adenda 9 — Dashboard SVD: 2 bugs corregidos (drill por tipo + horas) (2026-06-26)
Pedro reportó que el drill del rubro Preliminares mostraba $5,5M cuando el Costo de Obra decía
$10,5M, y que no había horas presupuestadas en MO UOCRA. Causa raíz y fix (reader del dashboard):
- **Drill no cerraba con Costo de Obra (rubros sin split MT/MO)**: el drill filtraba por `tipo`
  (`want=MAT if tipo==MT else MO`). Un rubro como "Preliminares" (en el plan es UNO solo, sin
  split MT/MO; vive en columnas A+C+D de 1_Presupuesto) tiene `tipo="—"` → caía al branch MO →
  mostraba solo MO/OTR+MO/ALB ($5,5M), omitía el MAT ($4,9M). El Costo de Obra sí suma los 3 ($10,5M).
  Fix en `drilldown.py`: insumos filtrados por la **apertura de rubro que matchea** (MAT si A=rubro,
  OTR si C=rubro, ALB si D=rubro; key MAT/OTR/ALB en `_composicion_por_item` + `_subs` en
  `_presupuesto_tareas`). Rubros tipados (CH/GDR) → idéntico; no-tipados → cierran. Verificado:
  **0 discrepancias drill vs Costo de Obra en las 3 obras** (SVD 22 rubros, CH 22, GDR 20).
- **+ bug pre-existente expuesto**: tareas con **cant=0** (ej. 24.04 "Protecciones y defensas",
  costo/ud $1,2M) las contaba el drill a costo×1 (`cant or 1`) pero el Costo de Obra a ×0. Fix:
  excluir cant=0 del drill (`monto = cost*cant`; presupuesto efectivo 0).
- **Horas presupuestadas = 0 → BUG mío de la integración**: `1_Composicion` col S quedó con header
  "MO/ALB"; el reader (`_jornales`) busca "rubro". Fix: header S → "Rubro". Ahora **32.757h ppto**
  vs 43.156h acum, por rubro/categoría UOCRA.
- **EQ sigue excluido** del drill y del costo controlable (confirmado por Pedro, decisión 2026-06-13).
- Cambios solo en `dashboard_v2/reader/drilldown.py` + `svd_integrar_composicion.py` (header).
  No tocó la lógica de negocio; es fix de reconciliación (principio no-negociable del dashboard).


### Adenda 10 — Consolidación de tareas partidas 2.01 y 24.10 (un código + 4 rubros) (2026-06-26)
El Resumen original de SVD abría en 2 algunas tareas para poder asignarles 2 rubros distintos (no
tenía la apertura de 4 columnas de la v8): `2.01`→`2.01.01`/`2.01.02` y `24.10`→`24.10.01`/`24.10.02`.
La migración v8 había respetado las subdivisiones. Pedro pidió volver a **un único código por tarea**
(como el presupuesto original) usando las 4 columnas de rubro de la v8, según `Pto. Costos` del
Resumen original. Hecho en `1_Presupuesto` (`scripts/svd_merge_partidas.py`):
- **2.01 Excavación a máquina** (m3, cant 1266) → fila única: `K=18.400` MO/OTR (C=*Movimiento de
  Suelos*) + `L=7.809,62` MO/ALB (D=*Homigón MO*) + `M=117,14` EQ. Venta `S=33.090` (suma de las 2
  porciones). E=`2.01`.
- **24.10 Volquetes** (mes, cant 8) → fila única: `J=200.000` MT (A=*Gastos Generales*) +
  `L=49.934,24` MO/ALB (D=*Albañilería MO*). Venta `S=314.138`. E=`24.10` (=24.1 float).
- Segundas filas (r17, r49) **vaciadas** (no borradas — evita romper fórmulas por fila absoluta):
  rubros→"-", código/cant/costos/venta→vacío. Las fórmulas N/O-V computan 0.
- **Value-preserving EXACTO**: costo obra gris $897.042.888 y venta $1.158.163.185 intactos
  (sanity venta ≈0); margen 1,257 preservado en ambas (la suma de ventas conserva el margen).
- **Resuelve los huérfanos** de 2.01/24.10 en `1_Composicion`: ahora el código único matchea el
  XLOOKUP → S resuelve (2.01→Homigón MO, 24.1→Albañilería MO).
- Verificado dashboard: **todos los rubros reconcilian** drill vs Costo de Obra (ninguno falla);
  2.01 aparece en *Movimiento de Suelos* ($23,29M) y *Homigón MO* ($9,89M), 24.10 en *Gastos
  Generales* ($1,6M) y *Albañilería MO* ($0,40M), todos con comp_ok=True. recalc 0.
- ⚠ Lección openpyxl: `ws.cell(r,c,None)` **NO borra** (value=None == "sin valor" → solo devuelve
  la celda); hay que usar `ws.cell(r,c).value = None`. El primer intento dejó las filas sin vaciar.
- Backup: `archivos/output/_bak_SVD_v8_2_pre_merge.xlsx`.
