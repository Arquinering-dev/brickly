# pendientes.md — Ítems que requieren confirmación de Pedro

> Registrar aquí cualquier ambigüedad que NO debe resolverse asumiendo.
> Cada ítem debe tener: descripción, contexto, y opciones conocidas.
> Cuando Pedro confirme, mover a la sección "Resueltos" con la decisión.

---

## ✅ Resuelto — Auditoría dashboard COMPLETA (5 tandas, 7 vistas + 6 drills), 2026-06-26
Auditoría de 3 capas (trazabilidad · paridad de cálculo · cumplimiento) sobre las 3 obras. Reconciliación
verificada al peso: drill de rubro 100% (24/24·23/23·23/23), drill de mes 100% (post-fix), drill de
subcontrato 100%, ledger cert = rollup, base+CAC+IVA = total por cert, presupuesto = 0_CONFIG (Δ=0).
Detalle del contrato/motor vigente en `dashboard_v2/CLAUDE.md` §"Estado v2 — post-auditoría".

**Tanda 0 (motor) — corregido (reader + front DS):**
- **T0-1 🔴 Deflactación CAC rota en GDR/SVD**: `cac_ratio_map` anclaba por header CH-céntrico
  ("Ratio deflactación"/"Mes"); GDR/SVD usan "Indice"/"Escala de tiempo" → ratio vacío → gasto
  "deflactado" = nominal. **Fix**: detección de la columna ratio **por contenido** (numérica en
  (0,2] con el 1,0 del mes base). Ahora GDR deflacta 12,3% y SVD 27,2% (eran 0%). CH sin cambios.
- **T0-3 🟡 Fila "Total" fantasma (SVD)**: `2_Movimientos!r320` (neto −$87,8M) se ingería como
  movimiento. **Fix**: `load_movimientos` corta filas cuyo cuenta/rubro empieza con "total".
- **T0-2 🔴 Gaps silenciosos**: nuevo bloque `data_gaps` en el contrato (CAC faltante, SC sin
  tagueo, cobros sin conciliar) + banner 🔴/🟡 en Dashboard/Cash/Avance/Recursos.
- **T0-4 🟡 Cobrado con dos fuentes**: headline `cobrado` = tesorería (2_Movimientos, def. congelada);
  `cobrado_conciliado` = Cert_* como conciliación; gap si difieren. Tooltips "i" aclaran cada uno.
- **T0-5 🟡 Avance físico vs definición**: se exponen los dos — `avance_fisico_pct` (Cert_Control_OC
  col E) y `avance_financiero_pct` (cert avance ÷ venta) — con "i". Doc `CLAUDE.md` ppio 4 actualizado.

**Tanda 1 (Control + drill Rubro):** GGBB drill — cada línea de Gastos Generales/Directos/Indirectos
se despliega a las cuentas Tezamat que la componen (`rubro.gastos[]`, Σ=gastado exacto). Columna
"Gastado (defl.)". `CLAUDE.md` deep-dives corregido (drill lee `2_Movimientos`, no `2_Gastos`). El
mapeo gasto→línea ya era explícito (`GASTO_A_LINEA`); su afinación fina depende del plan de cuentas.

**Tanda 2 (Flujo de Caja + drill Mes):** drill de mes incluye egresos negativos (notas de crédito) →
reconcilia con la barra del chart (antes 3/6·10/19·2/7, ahora 100%). Chart con tokens de color + serie
"Gastos Dir/Ind" separada (verificado sin doble conteo con Tezamat). Labels en español + "nominal".

**Tanda 3 (Avance y Cert.):** drawer de OC separa "Certificación financiera" (con anticipo/CAC/IVA) del
"Avance físico por tarea" (base venta) con "i" — no reconcilian mid-obra por el adelanto del anticipo
(desacopio), convergen al 100%. Nuevo `data_gap` "facturación sin cargar". OC adicionales sin partidas
muestra nota. Columna "Cert. Avance"→"Cert. Total".

**Tanda 4 (Subcontratos + Jornales):** drill de subcontrato saca CS (cargas sociales) de la base (regla
SPEC §4, alineado con el control). SC sin pagos → estado `sin_datos` (dot gris) en vez de verde. Nuevo
`data_gap` "jornales sin presupuesto" (GDR). Alerta "horas-hombre >100%" al semáforo (SVD 126%).

**Pendientes de DATOS que la auditoría dejó visibles vía `data_gaps`** (no son del dashboard):
facturación/cobro sin cargar en las 3 obras · subcontratos sin tagueo en GDR/SVD · jornales GDR sin
ppto / SVD >100% · CAC nov-2024 GDR · **inconsistencia OC-contrato vs Σ-PV de tareas en GDR** (el
certificado a nivel OC no coincide con la suma de PV de sus tareas en 1_Presupuesto — revisar con Arquinering).

Pendiente de fondo (no bloqueante): **maestro CAC cross-obra** (ya listado abajo) — el fix de
robustez lo desacopla, pero sigue siendo la mejora de arquitectura recomendada.

## ⏳ Pendientes abiertos

### Clasificación MO/OTR vs MO/ALB — alinear criterio con Arquinering (2026-06-26)
Al auditar el APU Unificado SVD aparecieron casos donde la **columna del `01`** y la **fuente del
dato** se contradicen para clasificar la mano de obra:
- Cotizaciones que vienen de **partidas APU** (obreros UOCRA) puestas en la **columna I (otro)**
  → el presupuesto estima subcontratarlas (ej. cielorrasos 14.0x, eléctrico). Se clasifican **OTR**.
- Cotizaciones que vienen de **SUBCONTRATOS** puestas en la **columna J (albañil)**
  → ej. 7.03 "Buña en revoque". Se clasifican **OTR** (fuente subcontrato manda; opción B, confirmado).
- Regla provisoria implementada (`_mo_clasif_columna` en `svd_pres_parser.py`): **clasificar por
  columna** (I→OTR, J→ALB), EXCEPTO fuentes con clasificación definitiva: `MO HA AING`=ALB (nómina
  propia hormigón), `SUBCONTRATOS`/`MO HA SILVA`=OTR. Flete/traslado=OTR.
- **A definir con Arquinering**: cuándo cotizan obreros (UOCRA) en MO/OTR y subcontratos en MO/ALB,
  y qué significa cada columna en su criterio de armado del presupuesto. Cuando haya definición,
  dejarlo como regla firme (hoy es provisoria/best-effort).


### APU Unificado SVD 4140 — flags de composición (2026-06-25, refinado Fases A–F)
Construcción del APU Unificado SVD (ver `sesion_2026-06-25_SVD_APU.md`). Composición reconcilia
con el presupuesto **sin pintura** ($1.162.951.649 vs $1.162.897.726, Δ 0,0046%). Tras el feedback
de Pedro (Fases A–F), la mayoría de los flags se **resolvieron**; quedan 2 a confirmar:
- ⏳ **23.01 "Albañilería parrilla completa"**: la fuente **duplica (×2)** en su propio armado
  (`Tareas!J200`=593k pero la suma de sub-componentes=296k). La composición se **escaló al total
  presupuestado** (preserva ítems y proporciones). Confirmar que el presupuesto es el correcto.
- ⏳ **1.09 "Trámite luz de obra"**: MO escalada ×0,795 (mismo tipo de quirk de fuente).
- ✅ **Topógrafo (1.02)** → reclasificado **MO/OTR** (Fase A: col "otro" manda; ALB solo nómina).
- ✅ **Baños químicos (1.06)** → MO/OTR (Fase A: flete/traslado y alquileres → OTR).
- ✅ **Hormigón AING (rubro 3)** → MO/ALB **con jornales por categoría UOCRA** (Fase B: bloques de
  `MO HA AING`). 1.592 jornales presupuestados (OFI 794 + ESP 769 + AYU 28) → control de horas OK.
  3.03/3.04 → MO/OTR (sección resumen = precios SILVA, confirmado por Pedro).
- ✅ **Categorías MO**: 23→10, normalizadas a UOCRA por jornal. (Pendiente menor: confirmar el match
  ESPECIALIZADO 75.113/día ↔ categorías de `2_Quincenas` al integrar al Resumen v8.)
- ✅ **Equipos rotos #N/A**: ninguno afecta el costo (P-137 era pintura excluida).
- Menor: **4.03 "Muro tipo 4"** Δ MAT 1,0% (composición real P-XX vs índice APU; dentro de tolerancia).

### Control Presupuesto — bloques GGBB con doble fuente de gasto (2026-06-24, dashboard)
Tras reformatear los bloques Gastos Generales/Directos/Indirectos (ver `sesion_2026-06-24.md`),
quedaron 3 ítems de **datos/mapeo** a confirmar con Arquinering (ninguno bloquea el dashboard):
- **Payroll - Socios sin línea de presupuesto** → hoy figura como fila **"sin ppto"** en Gastos
  Indirectos (gasto visible, presupuestado 0). Pedro: *"agregarlo igual y luego vemos contra qué
  impacta del lado del presupuesto"*. Cuando se defina la línea de `1_GGBB`, agregar la entrada a
  `GASTO_A_LINEA` en `dashboard_v2/reader/read_obra.py`.
- **Typo de rubro "Homigón MO" en `1_Presupuesto` de CH** (falta la "r"): por eso NO agrupa con
  "Hormigón MT" en el orden de obra (son bases distintas para el agrupador MT/MO). Es un error de
  carga en el Excel, no del dashboard. Corregir el texto del rubro en CH (cols A/C de `1_Presupuesto`)
  para que agrupen — track Excel.
- **Cuentas indirectas de Tezamat sin match a línea de ppto** → caen como "sin ppto" en su sección
  por keyword (`_seccion_de_cuenta`, best-effort). Casos a refinar: **Edenor** (electricidad →
  debería mapear a "Energía de obra"), **Aysa/Aguas** (→ "Agua de obra"), honorarios varios
  (H. Contables/Escribanía/Arquitectura/Gestoría). Definir si se mapean a una línea o se dejan sueltos.

### Migración SVD 4140 (El Salvador 4140) a v8 — COMPLETA (2026-06-22)
**Estructura v8 terminada y cargando en el dashboard** (`SVD_4140_Resumen_de_Obra_v8_1.xlsx`):
recalc 0 errores + COM cacheado + Flask 200. **Portfolio ahora 3 obras** (CH+GDR+SVD), reader
**sin cambios de código** (lectura anclada lo absorbe). KPIs: avance **62,8%**, ppto venta
$1.158.163.185 (legacy exacto), certificado total $1.054,5M, OC01 89,5% / OC02 48,8% / OC03 0%.
Pipeline reproducible: `scripts/svd_bloque{2,4,356,6b,7,8}_*.py` (+ `inventario_svd.py`).
Pendientes de **datos** (no de estructura):
- **Cobros (`Cert_Facturacion`) vacíos** → `cobrado=$0`. Falta el detalle de cobros por cert
  (igual que CH/GDR): comprobante, monto, fecha, TC, retención. Hoy los ingresos de `2_Movimientos`
  (depósitos del Fideicomiso SVD HOUSE, cta 410222) son lump sin desglose por certificación.
- ~~`2_Quincenas` placeholder~~ **CARGADO (2026-06-22, `svd_bloque6b2_quincenas.py`)**: 163 registros de
  HORAS desde las 4 hojas M.O. (horas = días-persona × 8). Hormigón 26.060 hs · Albañilería 13.108 ·
  Sanitaria 3.868 · Eléctrico 120. Vista Jornales del dashboard OK. **Columnas de costo (K-O) VACÍAS a
  propósito**: el dato monetario lo carga Arquinering en Tezamat (decisión Pedro; evita doble conteo con
  `2_Movimientos`). `horas_ppto=0` hasta que haya `1_Composicion` (APU). Quedan como dato local hasta el
  maestro cross-obra de horas.
- **OC03 Adicionales sin avance** ($15,3M contrato, "🔴 Sin iniciar"): no llegó doc de certificación
  de adicionales. Sus tareas tampoco están en `1_Presupuesto` (solo PTO01/02). Cargar si se quiere trackear.
- **Tagueo de pagos a subcontratos** en `2_Movimientos` (cols Q/R con `SVD-SC-NNN | TIPO`): sin taguear
  → matriz `2_Subcontratos` muestra pagado=0 / saldo=full. **Deliverable para Arquinering generado**:
  `docs/Carga_Tezamat_IDs.xlsx` (unificado, reemplaza `Carga_Tezamat_IDs_GDR_CH.xlsx` + `GDR_Propuesta_*`).
  8 hojas: catálogo Subcontratos (GDR+CH+SVD) · catálogo Ingresos ("Cliente") · **Cobertura (auditoría)**
  (por subcontrato: contrato vs movs identificados, % cobertura, estado; por OC: certificado vs depósitos) ·
  **Mov SVD/CH/GDR (propuesta)** (desc original → `{ID} | TIPO | desc`). Scripts: `generar_carga_tezamat_unificado.py`
  + `relevamiento_tezamat_obras.py` (match por apellido + 'SEREN' truncado; excluye nómina propia genérica).
  **SVD: 40 pagos a subcontratos identificados** (6/10 SC con movs) + 21 cobros a asignar. ⚠ SC sin movs en
  el extracto: CELSI (SC-001), PASQUARIELLO (SC-004), AMARILLA (SC-005) — ¿pagados fuera del período?
  Cobertura parcial en varios SVD (movs < contrato) — confirmar con Arquinering.
  **2 ajustes (2026-06-23):** (1) **CH NO está tagueado en Tezamat** — el tag vive solo en el Excel (col E);
  el relevamiento usa la **observación original** (col P) y propone el tag (CH-SC-003 Micropilotes pasó a 7
  movs $51,9M = 93% contrato). Las 3 obras quedan pendientes de taguear en Tezamat. (2) Las hojas Mov incluyen
  **Nº Asiento + Nº Comprobante** para ubicar cada movimiento en Tezamat. Filas de CAC desagregado de CH salen
  con nota (cargar el CAC aparte del movimiento base). Script: `relevamiento_tezamat_obras.py`.
- **Split fiscal por OC** derivado de `Facturacion` (OC01 B37,5/N62,5 · OC02 B24,1/N75,9 · OC03 fallback
  B31/N69). IVA 10,5% (obra civil). Provisional hasta confirmar partición real por cert. `0_CONFIG!B15`
  quedó "B31/N69" como rótulo global — revisar.
- **Mapeos de rubro marcados** (bloque 2): Agrimensura→Preliminares, Depresión de napas→Movimiento de
  Suelos, Gastos en Personal→Gastos Generales, Consumibles y Ferretería→Varios Ferretería, Equipos→
  Alquiler de Equipos. Split MO OTR/ALB por cuadrilla propia (Hormigón/Albañilería/Eléctrico/Sanitaria).
  Subcontratos: ALBAMO→Albañilería MO, ELECMO→Eléctrico MO, AIRE→Termomecánica MO, GESTORIA→H.Gestoria,
  CESPEDES Revoque/Yeso→Durlock MO. **Confirmar con Arquinering.**
- **`1_Composicion` placeholder** (SVD no tiene APU Unificado): drill-down de composición por insumo sin
  datos. No bloquea el control.
- **Venta = input por tarea — markup CONFIRMADO (Pedro 2026-06-22):** el markup es **1,2569 en casi todo**;
  la única excepción son los ítems **3.02 a 3.12 (hormigón estructural H30: Tabique, Zapata, Platea, Rampa,
  Losa, Vigas, Columna, Escaleras…) a 1,3952** — es **intencional** (margen mayor en estructura), se deja
  tal cual. Mi framing inicial de "1,333/1,268 por presupuesto" era un promedio mal calculado: no hay tarea
  a 1,33. `venta=input por tarea` preserva ambos coeficientes exactos.
- ⚠ **SC-002 SERENO DE OBRA presup=0** pero pagos>0; varios SC con pagos>presup (CELSI presup 20,6M vs
  pagos 41M) → revisar montos de contrato en `Contratistas`.

### (histórico) Migración SVD — decisiones de Bloque 2 (2026-06-22)
Tercera obra. Legacy clásico (25 hojas, nunca migrado a v8) → construcción legacy→v8 completa
clonando la estructura de GDR v8_12 y repoblando. Misma forma que GDR: **3 OCs** (Pto1 ant.20%,
Pto2 ant.40%, Adicionales). Archivo de trabajo: `archivos/output/SVD_4140_Resumen_de_Obra_v8_1.xlsx`.
Insumos en `archivos/fuente/`: `SVD 4140 - Resumen de Obra.xlsx`, `SVD 4140 Mayores 2026-06-01.xlsx`
(Tezamat, centro de costo SALVA4140, 320 filas), `SVD 4140_Pto. 01_Cert.12.xlsx` (12 certs),
`SVD 4140_Pto. 02_Cert. 08.xlsx` (8 certs). Decisiones confirmadas con Pedro (2026-06-22):
clonar GDR v8_12 + repoblar; mapeo de rubros con mejor criterio (marcar acá); split fiscal derivado
de la hoja `Facturacion`; **venta = input por tarea** (markup NO uniforme: PTO01 1,333 / PTO02 1,268
y varía por tarea → un coef único no preserva los montos de OC).

**Bloque 2 (`1_Presupuesto`) COMPLETO** (`scripts/svd_bloque2_presupuesto.py`): 191 tareas, value-
preserving (venta reconstruida = $1.158.163.185 EXACTO vs subtotales Pto.Vta M56/M239; costo
$897.042.888 = subtotales Pto.Costos M58/M241). recalc 0 errores. **Decisiones a revisar:**
- **Mapeo rubros (Q8)**: `Agrimensura → Preliminares` (precedente GDR), `Depresión de napas →
  Movimiento de Suelos` (1 tarea), `Gastos en Personal → Gastos Generales` (no se usa en presup),
  `Consumibles y Ferretería → Varios Ferreteria`, `Equipos → Alquiler de Equipos`. Confirmar.
  (Rubros del dropdown no usados en presup: Artefactos Sanitarios, Instalación Incendio, VitroBlock.)
- **Split MO OTR/ALB**: heurística — rubros con cuadrilla propia (hoja M.O. legacy: Hormigón,
  Albañilería, Eléctrico, Sanitaria) → MO interna (ALB, col M/D); resto → MO subcontratada (OTR,
  col L/C). El legacy NO separa OTR/ALB (una sola columna MO). Confirmar la lista de rubros propios.
- **Venta por tipo (R/S/T/U)**: se reparte proporcional al costo (suma exacta = venta unit P);
  tareas con costo 0 y venta>0 → toda la venta a MT. Es una asignación, no dato legacy.
- **`1_Composicion`**: SVD no tiene APU Unificado → va placeholder (igual que el maestro cross-obra
  pendiente). No bloquea el control de presupuesto; sí deja la vista Jornales sin datos hasta el maestro.

### Migración GDR a v8 — COMPLETA (2026-06-22, `GDR_..._v8_12.xlsx`) — faltantes de datos
GDR quedó acondicionado a la estructura v8 nueva y el dashboard lo lee (portfolio multi-obra real
CH+GDR). Detalle completo en `logs/sesion_2026-06-22.md`. Pendientes de **datos** (no de estructura):
- **OC03 (Adicionales 01)**: `% anticipo` y `mes base CAC` quedaron **provisionales** (anticipo 0,
  mes base dic-2024). **Confirmar con Arquinering** los del Pto 3. (Pedro lo dejó "a consultar".)
- **OC03 avance físico = 0% en el reenganche**: las tareas de adicionales NO están en el `1_Presupuesto`
  base, así que el avance ponderado por budget las cuenta 0 (su certificado $71,6M sí se trackea por
  `Cert_Calculo`). Esto baja levemente el avance de obra (63,7%). Si se quiere avance físico de
  adicionales, hay que **agregar sus tareas a `1_Presupuesto` como PTO 03** (tienen PV, no costo).
- **Split fiscal por certificación = default OC (70/30) provisional**: algunas certs de GDR fueron
  65/35 o 60/40 (lo dijo Pedro). Hoy `Cert_Calculo!H` usa el sugerido de la OC. El "$ Certificado total"
  con CAC+IVA es provisional; los KPIs reales son avance físico / base. Refinable por cert.
- **`2_Movimientos` YA CARGADO** (extracto Tezamat real, 851 filas, Libro Mayor por centro de costo GDR).
  El proveedor (col F) viene vacío y el detalle va en `Observaciones` (col E), **truncado a ~30 chars**.
- **Tagueo de pagos a subcontratos — PROPUESTA generada, a confirmar (2026-06-22)**:
  ahora en `docs/Carga_Tezamat_IDs.xlsx`, hoja **Mov GDR (propuesta)** (unificado; el archivo
  `GDR_Propuesta_Tag_Subcontratos_2_Movimientos.xlsx` fue absorbido). Generado por `scripts/proponer_tag_subcontratos_gdr.py`.
  31 movimientos propuestos con texto `GDR-SC-NNN | TIPO | desc` para col E. Validación fuerte: SC-003
  Anclajes Cima cuadra casi exacto con el contrato ($3,037M). **Decisiones a confirmar antes de aplicar**:
  - (a) Cuenta 53005 (Hormigón MO): certificados "Hormigon Fundaciones / Losa / Rafael Meza" (filas
    481,482,486,488,489,490) → ¿SC-005 cuadrilla o SC-003 Anclajes/Fundaciones? Asignados **tentativo
    SC-005, confianza Baja**.
  - (b) Cespedes: certificado partido en Yeso (SC-001, Durlock MO) y Revoque (SC-002, Albañilería+Revest.
    MO) porque emite ambos el mismo día. Confirmar el corte.
  - (c) SC-004 Celsi tiene `Monto Presup.`=0 en `2_Subcontratos!E7` pero ~$8,7M de pagos → cargar el
    monto del contrato o el % consumido/saldo dará incoherente.
- **GDR-SC-NNN**: cuando se aplique el tagueo (copiar col "OBSERVACIONES A ESCRIBIR" sobre `2_Movimientos!E`),
  la matriz de subcontratos concilia sola vía SUMIFS por `mov_id`/`mov_tipo`.
- Hereda: maestros cross-obra (CAC/jornales/subcontratos/quincenas — hoy locales en GDR por Q1/Q5/Q6);
  Supervisión de Obra directo/indirecto definitivo; excepción de reader para mostrar Supervisión en
  bloque Obra pese a 52xx (cross-obra, aún no aplicada).


### Maestros cross-obra (datos de fuente única que alimentan todas las obras) — ARQUITECTURA
Estado futuro (HANDOFF §1.1/§1.2; relacionado con el hallazgo B5 de la auditoría 2026-06-19): varios datos
NO deben vivir duplicados en cada resumen de obra, sino en un **archivo maestro** que se actualiza en un solo
lugar y del que cada obra toma su parte. Confirmado por Pedro (2026-06-19):
- **`2_Quincenas` (horas trabajadas)**: deja de existir como hoja en cada resumen. Pasa a **maestro de horas**
  (obra/rubro/categoría/quincena); cada obra consume lo suyo. Es **fuente de HORAS**, no de plata (la plata de
  jornales va a Tezamat → `2_Movimientos`). Mismo patrón que CAC y tarifas UOCRA.
- **Índice CAC (INDEC)** y **tarifas UOCRA por categoría**: ya son cross-obra por naturaleza; hoy se cargan por
  archivo (hojas `0_Indice_CAC`, `0_Jornales_MO`). Candidatos a maestro compartido también.
- **Tipo de cambio USD** (MEP), **maestro de Subcontratos** y eventualmente **Gastos Dir/Ind**: mismos candidatos.
- **Implica**: sacar esas hojas del resumen por-obra, crear los maestros, y un proceso (Python, sin vínculo
  vivo) que vuelque a cada obra su parte. Crítico antes de escalar a la 3ª/4ª obra (si no, un cambio de
  estructura = N migraciones). El reader del dashboard ya lee `2_Quincenas` solo por horas, así que el cambio
  es de origen del dato, no de cálculo.
- ⚠ **Trampa a evitar**: `2_Quincenas` tiene columnas de costo (`Costo Hs.` K-O) que el reader hoy ignora
  (usa solo horas). NO cablearlas al cash flow/control: duplicarían la plata de quincenas que ya está en
  `2_Movimientos`.

### Herramienta de Certificación de Avance Físico (app del Jefe de Obra) — A FUTURO
Paso 1 del circuito de ingresos (HANDOFF §5.3.1): web donde el JO carga el **% de avance físico por tarea**
(captura pura, sin cálculo) → genera el registro inmutable en `Cert_App_Output` (reemplaza la carga manual).
Se propuso el diseño (2026-06-19) pero **Pedro decidió no avanzar todavía**. Decisiones que quedaron por
definir cuando se retome: (a) plataforma — web en dashboard_v2 vs PWA offline vs AppSheet; (b) alcance v1 —
solo paso 1 vs paso 1+2 (validación DO + desacopio); (c) escritura al Excel — directo openpyxl+recalc vs
capa staging. Detalle de la propuesta en el chat de esa sesión.

### Reclasificar "Aguas" en Tezamat (2026-06-19)
La cuenta **`52104 Aguas`** está **mal clasificada**: corresponde a **Gastos de oficina** (no agua de obra).
Pedro va a pedir la reclasificación en Tezamat. Hasta entonces queda en el bloque **Indirectos** del Control
de Presupuesto (es admin/oficina igual, rama 52). Cuando se reclasifique, ajustar el nombre/cuenta en el
extracto. (Reemplaza la decisión vieja 2026-06-11 que la trataba como "agua de obra / gasto directo".)

### Control Presupuesto por bloques (v8_10, 2026-06-19) — notas
Implementado el Control en **4 bloques** (reestructurado): **Costo de Obra** (rubros rama 53, **ordenado por
etapa** del presupuesto) + **Gastos Generales** ($42,9M) + **Gastos Directos** ($89,9M) + **Gastos Indirectos**
($94,2M), cada uno presupuestado en `1_GGBB` **columna G** (los ítems con costo en J/K ya están en el ppto de
obra y no entran). IIBB/Imp.cheque quedaron dentro de Gastos Indirectos (ya no hay bloque "Financieros" aparte).
Pendientes asociados:
- **Mapeo gasto-cuenta → sección GGBB es best-effort** (`_seccion_de_cuenta` por keyword): Aguas + H. Seg e
  Higiene → Generales; Gastos en personal → Directos; H. Gestoría → Indirectos. **Confirmar con Pedro** si es
  el ruteo correcto (especialmente Gastos en personal: ¿Directos o Indirectos?).
- **Presupuesto GGBB a nivel de sección, no por cuenta** (GGBB es lista descriptiva, no cruza por código de
  cuenta). Si se quiere presupuesto por cuenta, hay que definir un mapeo GGBB-ítem ↔ cuenta Tezamat.
- **Rubros de obra sin línea de presupuesto** (gasto-only en el bloque Obra, salen rojo): Seguridad e Higiene
  (53026), Herrería MO (53028), Termomecánica. ¿Se les carga presupuesto en `1_Presupuesto` o son gasto-only?
- **Supervisión de Obra MO** ($61,7M ppto) sigue en Obra (tiene presupuesto); la decisión vieja era moverla a
  indirectos (52209 H. Ingeniería). Si se mueve, hay que sacarle la línea de `1_Presupuesto` y va a Indirectos.
- **Eléctrico MO / Herrería MO sin nº de cuenta Tezamat** (filas de quincena): se agrupan por nombre como obra;
  pasar su código (53020 / 53028) cuando se carguen.

### Certificaciones reales OC01 cargadas (v8_10, 2026-06-19) — FALTANTES
Se cargó el avance físico **real** de OC01 (documento `archivos/fuente/CH 2171_Presupuesto 01_Cert. #2.xlsx`,
certs #1 y #2) en `Cert_App_Output`. Reconcilia con el documento (Cert#1 $64,0M, Cert#2 $68,9M,
subtotal neto $55,1M, avance acumulado **22,13%** exacto). Se **vació lo inventado** (OC01 C03/C04,
todo OC02, todos los cobros de `Cert_Facturacion`). Queda pendiente de datos reales:

- **OC02 (Presupuesto 02)**: el contrato existe en `Cert_OC_Cliente` ($940M) pero **sin certificaciones**
  (rola a `🔴 Sin iniciar`). Falta el documento de avance de OC02 para cargarlo igual que OC01.
- **Partición fiscal efectiva por certificación**: el documento de avance NO trae el split Blanco/Negro
  real, ni el IVA efectivo, ni el MEP por fecha de cobro. Hoy `Cert_Calculo` usa los **defaults de la OC**
  (Blanco 65 / Negro 35, IVA 21%) como **provisional**, y el MEP se cargó al $1.276 del documento (dato a
  refinar por fecha de cada cobro). Por eso el "$ Certificado total" de `Cert_Control_OC` (con CAC+IVA) es
  provisional; los KPIs **reales** son base certificado / subtotal neto / avance físico. Falta: confirmar
  con Dirección de Obra el split fiscal real de cada cert para cerrar el total.
- **Cobros reales (`Cert_Facturacion`)**: vaciados (no hay datos). Falta el detalle de cobros (anticipo +
  cert #1/#2): comprobante, monto, moneda, fecha, retención, TC del cobro.

### Cambios a cargar en Tezamat — observaciones de INGRESOS (para conciliar OC01)
Para que el lado ingresos concilie (hoy inerte: los ingresos en `2_Movimientos` son depósitos lump del
Fideicomiso, cta 410222, sin desglose por certificación), cada cobro de OC01 debe cargarse en Tezamat con
la convención `{ID} | {TIPO} | {desc}` en Observaciones (Haber). Strings exactos a usar:

| Cobro | Observación (token ID + tipo) | Monto referencia |
|---|---|---|
| Anticipo OC01 | `CH-OC01-ANT \| ANT \| anticipo OC01` | $120.095.631 (base 20%) |
| Cert #1 — base con factura | `CH-OC01-C01-B \| BASE \| cert 1` | parte Blanco del neto $51,2M |
| Cert #1 — CAC con factura | `CH-OC01-C01-B \| CAC \| cert 1` | (CAC, no descuenta saldo) |
| Cert #1 — base sin factura | `CH-OC01-C01-N \| BASE \| cert 1` | parte Negro (USD@MEP) |
| Cert #2 — base con factura | `CH-OC01-C02-B \| BASE \| cert 2` | parte Blanco del neto $55,1M |
| Cert #2 — CAC con factura | `CH-OC01-C02-B \| CAC \| cert 2` | (CAC) |
| Cert #2 — base sin factura | `CH-OC01-C02-N \| BASE \| cert 2` | parte Negro (USD@MEP) |

**Acción para Arquinering**: los depósitos del Fideicomiso (cta 410222: $35M, $32M, $24,9M…) hoy son lump;
hay que **identificar/separar qué depósito paga qué certificación** y reemitir el registro con la observación
de arriba (separando base y CAC en registros distintos; el CAC suma ingreso pero no descuenta saldo a
certificar). El split exacto base/Blanco/Negro sale de la partición fiscal (ítem anterior).

### Relevamiento de carga Tezamat (CH 2171) — GENERADO (2026-06-18)
Documento `docs/Relevamiento_Tezamat_CH2171.md` (reproducible: `scripts/relevamiento_tezamat.py`)
con cada movimiento en formato original vs ajustado, para que Arquinering corrija la carga en
Tezamat. 126 movimientos, **55 con cambios** en 4 tipos: (1) 10 pagos a SC → agregar ID +
reclasificar rubro; (2) 2 separar CAC del base (SC-003); (3) 11 cargar quincenas como asiento;
(4) 32 cuentas sin rubro canónico (indirectos, pendiente plan de cuentas). 71 sin cambios.
- **Inconsistencia a revisar con Arquinering:** SC-003 (Micropilotes, Ajusta CAC=SÍ) tiene 5
  avances pero sólo 2 tienen CAC desagregado (filas 83→115, 107→116). Los otros 3 (filas 24, 90,
  106) no tienen línea de CAC — confirmar si corresponde CAC y, si sí, los montos.
- **Pendiente Pedro**: enviar el archivo con **todas las certificaciones** (avance físico por tarea
  en cada certificación) para trackeo real de avance — hoy el avance físico sale del rollup
  `Cert_Control_OC` (por OC), no por tarea.
- **Pendiente (a pedido)**: exportar el relevamiento en formato cargable por Arquinering (planilla/CSV,
  una fila por modificación). Por ahora alcanza el markdown.

### Dashboard v2 — VALIDADO contra v8_5 (2026-06-19)
Comparados 17 KPIs del dashboard v2 (recalcula de v8_6 crudo) contra los valores que daban las
hojas `3_*` calculadas de `CH_2171_Resumen_de_Obra_v8_5.xlsx`. **Los 17 coinciden al centavo**
(Control Ppto por rubro y total controlable, Cash Flow cobrado/egresos/resultado/valle, Subcontratos
comprometido/pagado/saldo por SC, Jornales por rubro). Script: `dashboard_v2/_validar_v85.py`.
- **Bug encontrado y corregido en la validación**: `_jornales` contaba (a) filas de `1_Composicion`
  con Rubro=`0`/vacío (+7.250 h) y (b) filas MO cuya "categoría" (col Descripción) era texto libre
  (p.ej. "MO Albañilería complementaria…"), no una categoría UOCRA. Se agregó filtro a las categorías
  válidas (CAPATAZ/ESPECIALIZADO/OFICIAL/MEDIO OFICIAL/AYUDANTE/JEFE DE OBRA) y se descartan rubros
  inválidos. Post-fix los 7 rubros del control viejo coinciden exacto (Homigón MO 1.704→1.432 ✓).
- **Diferencias de alcance (no regresiones, reconciliadas)**: el v2 incluye en jornales Preliminares MO
  (+784 h ppto) y Herrería MO (+32 h acum) que el control viejo no listaba; y el total de egresos del v2
  (93,3M) integra los rubros sin presupuesto/indirectos ($8,5M) que el v8_5 segregaba en buckets
  Directos/Indirectos (el costo controlable estricto coincide exacto: $84.807.322,81).

### Dashboard v2 (estructura v8_6) — CONSTRUIDO (2026-06-18), pendientes de confirmación
Nuevo proyecto **standalone** `dashboard_v2/` (puerto 5001), independiente del `dashboard/` v1.
Lee la estructura v8_6 (2_Movimientos crudo + circuito `Cert_*`) y produce el **mismo contrato
JSON** que el v1, así reusa el frontend DS "Industrial Integrity" sin tocarlo. Sólo Chivilcoy
(GDR aún no migrado a v8_6); el portfolio cross-obra anda con una sola obra. Verificado end-to-end
(6 módulos + drill-downs renderizan; recalcula y reconcilia: ppto_costo=$1.109.935.042,56 = `0_CONFIG!B16`
al centavo, drill de rubro recon ✓✓✓). Capa de derivación en `reader/movimientos.py`; cert/avance en
`reader/cert.py`. Decisiones de datos tomadas (a ratificar con Pedro):
- **Cobrado = circuito Cert_*** ($1.313M, `Cert_Control_OC` H), por tu instrucción "facturación con
  Cert_*". Los ingresos de **tesorería** de 2_Movimientos ($128,6M, cuenta 410222) van al **Cash Flow**
  (caja real). Son métricas distintas → confirmar que el gap (cobro certificado vs caja) es esperado /
  que Tezamat aún no cargó los cobros del fideicomiso como movimientos.
- **Avance físico = `Cert_Control_OC` col E = 42,96%** (NO certificado$/venta=88%, que infla por CAC+anticipos).
- **Avance por etapa = las 2 OCs** (PTO 01 / PTO 02) de `Cert_Control_OC`, no las 23 etapas constructivas
  de `1_Presupuesto` (cuyo `X`/`AG` doble-cuentan entre presupuestos). El drill de etapa filtra
  `1_Presupuesto` por la col "Presupuesto" (AQ) y SÍ reconcilia (PTO 01 → pv $600M = contrato OC01).
- **Cash Flow Gastos Directos/Indirectos** (`2_Gastos_DirInd`) = placeholder (slot listo). ¿Se cablean?
- **Quincenas**: el COSTO entra por 2_Movimientos (filas con Cuenta vacía: Eléctrico MO/Herrería MO);
  las HORAS por 2_Quincenas (jornales). Sin doble conteo. Confirmar la regla.
- Hereda el pendiente del cruce por Desc Cuenta: los **$8,5M / 8 cuentas sin rubro canónico** (Aguas,
  Varios Ferretería, Gastos Generales, H. Gestoría, H. Seg e Higiene, Gastos en personal, Seguridad e
  Higiene, Herrería MO) aparecen como **rubros "sin presupuesto"** en el Control. Se cierra con el plan
  de cuentas de Tezamat (ver entrada de abajo).

### Plan de cuentas Tezamat = fuente de verdad de rubros — EJECUTADO (2026-06-19, v8_7)
Diagnóstico v8_6 vs dashboard: `2_Movimientos` es el extracto **limpio** de Tezamat (17 cuentas, cada
una con código `Cuenta` col A + `Desc Cuenta` col B estandarizada — sin descripciones libres). El
riesgo NO es basura de datos sino que **la nomenclatura de cuentas de Tezamat ≠ la lista de rubros
canónicos del v8** (`_Listas`). Cruzando por `Desc Cuenta` contra los 27 rubros de `_Listas`:
- **89 mov / $84,8M cruzan limpio** · **4 mov / −$128,6M ingresos (cta 4xxx)** ·
  **33 mov / $8,5M (~9,1% del egreso) NO cruzan** → coincide con el sanity E102 de v8_4/v8_5.
- No cruzan: `53022 Gastos Generales` ($3,1M, near-miss de "Gastos Generales Obra"), `53026 Seguridad
  e Higiene` ($309k), `53023 Varios Ferreteria` ($558k), `5108 Gastos en personal` ($392k),
  `52204 H. Seguridad e Higiene` ($3,5M), `52210 H. Gestoria` ($520k), `52104 Aguas` ($104k).
- Causa raíz: la doc dice *"antes existían cols A/B que traducían cuenta→rubro; eliminadas"*. Esa tabla
  se borró y no quedó ningún mapeo `código→rubro` en el libro (`_Listas` es lista plana sin códigos).
- Fragilidad extra: `Homigón MO` cruza solo porque el **typo está replicado** en Tezamat/`_Listas`/`1_Presupuesto`.

**Decisión de Pedro (2026-06-18):** el **plan de cuentas de Tezamat manda**. Esos rubros se usan para
(a) clasificar las tareas de `1_Presupuesto` (Materiales / Provisiones / MO subcontratada / MO interna),
(b) los rubros del informe de quincenas (control horas trabajadas vs ppto). El Excel debe tener
**sanity checks** que validen que todo rubro de tarea ∈ plan de cuentas, y las celdas de rubro deben
ser **listas desplegables (data validation)** con los rubros del plan. → Implica reconciliar `_Listas`
contra el plan real y cablear las dropdowns + checks en `1_Presupuesto` (A/B/C/D) y `2_Quincenas`.

**EJECUTADO (2026-06-19):** llegó `archivos/fuente/AING - Plan de Cuentas.xlsx` (plan contable
completo; rama **53 OBRA** = rubros, con split MT/MO; ramas 50/51/52 = indirectos). Las 15 cuentas
que CH usa en `2_Movimientos` resuelven TODAS contra el plan por código. Reconciliación reproducible
en `docs/Reconciliacion_Plan_Cuentas_CH2171.md` (`scripts/reconciliar_plan_cuentas.py`). Producido
**`CH_2171_..._v8_7.xlsx`** (`scripts/aplicar_plan_cuentas_ch.py`, backup `_bak_CH_pre_plancuentas.xlsx`):
- `_Listas` reescrito = rama 53 OBRA (con código) + Mov.Variables (52302) + Supervisión de Obra MO (52209).
- Renames/merges en `1_Presupuesto`: Agrimensura MT/MO→Preliminares; Gastos Generales Obra MT/MO +
  Mantenimiento MO→Gastos Generales; Seguridad e Higiene MO→Seguridad e Higiene. (`Mov. Variables`
  queda rubro de obra por decisión.)
- Dropdowns (data validation con nombre definido `RUBROS_PLAN`) en `1_Presupuesto` A:D y `2_Quincenas` E.
- Sanity check `_Listas!F2/F3` (rubros de tarea ∈ plan = **✓**).
- Value-preserving: total presupuestado intacto (1.109.935.042,56); cruce presup↔gasto mejora
  (Gastos Generales y Seguridad e Higiene dejan de ser sin-ppto falsos; sin-ppto 8→6).
- dashboard_v2 apunta a v8_7 (`config/obras.yaml`); reader OK, 0 errores de fórmula.

**Abierto todavía (Pedro / paso siguiente):**
- ~~**Supervisión de Obra MO (52209)**: mover su presupuesto a indirectos~~ **REVISADO (2026-06-22):**
  Pedro decidió que Supervisión de Obra es un **rubro de obra visible** (suma al ppto de obra y se
  factura al cliente), **mismo tratamiento en CH y GDR** (en ambos es etapa del presupuesto). **No**
  se mueve a indirectos. Implica una **excepción en el reader** del dashboard (bloque 10/Q7,
  cross-obra): mostrarlo en el bloque Obra pese al código 52xx. **Pendiente de definición final con
  Arquinering** (directo/indirecto definitivo).
- **Indirectos como rubros sin-ppto en el control**: Aguas, Gastos en personal, H. Gestoria,
  H. Seg e Higiene (ramas 51/52) siguen apareciendo como rubros "sin presupuesto" en el control v2.
  Para sacarlos del control por rubro hay que enrutar 50/51/52 a la sección de indirectos en el
  reader de dashboard_v2 (cambio de reader, no de Excel). Decisión directo/indirecto ya orientada
  por el plan (viven en 52xx = indirecto).
- **Herrería MO / Varios Ferreteria**: cuentas 53 reales con gasto pero sin línea de presupuesto →
  quedan sin-ppto legítimo (¿se les carga presupuesto o son gasto-only?).
- Colisión **Seguridad e Higiene**: `53026` (obra, directo) vs `52204 H. Seg. e Higiene` (honorario,
  indirecto) — quedan separadas por el plan; confirmar que es el tratamiento deseado.

### Circuito de Certificación v8 (CH 2171) — post B1–B5 (2026-06-17)
Implementado el circuito (`Cert_OC_Cliente`, `Cert_App_Output`, `Cert_Calculo`, `Cert_Facturacion`
+ reenganche de avance en `1_Presupuesto`) en `archivos/output/CH_2171_Resumen_de_Obra_v8_2.xlsx`.
recalc final 0 errores. Queda pendiente:
- **Abrir `v8_2` en Excel y guardar una vez**: openpyxl no deja valores cacheados → el dashboard
  (data_only) vería las celdas `Cert_*` en blanco hasta ese guardado. Es además el recálculo real
  que valida XLOOKUP/MAXIFS (recalc.py no evalúa fórmulas, solo detecta `#REF!` cacheados).
- **Sincronizar con `dashboard/data/`**: decidir si `v8_2` reemplaza al `v8_1` que lee el dashboard.
- ~~**Códigos duplicados en `1_Presupuesto!F`**: 24.01/24.03/… aparecen 2 veces~~ **RESUELTO (2026-06-18)**:
  no eran duplicados sino el bloque de indirectos (Ayuda de Gremios + Jefatura) de **cada presupuesto**
  (PTO 01 filas 5–53, PTO 02 filas 54–211). Se agregó la dimensión **Presupuesto** (Fase 1) y los
  SUMIFS/lookups del circuito pasaron a **clave compuesta (Presupuesto+Código)**, así cada 24.01 toma
  solo el avance de su PTO. Ver sesión 2026-06-18.
- **Fórmula de control `Cert_App_Output!L`** (diferida de B2, agregada en B5): quedó como
  `=IF($E="","",IF(AND(ISNUMBER($I),$H<=1.0001),"✓","⚠"))` — ✓ si la tarea existe en ppto y el
  acumulado ≤100%. La spec no fijó la fórmula exacta; revisar si es el control que Pedro quiere.
- **Jubilar `2_Certificaciones` (hoja vieja, obsoleta)**: Pedro decidió **dejarla por ahora**
  (2026-06-17). Queda obsoleta pero inofensiva. Para retirarla a futuro hay que: (1) re-apuntar sus
  **40 consumidores** al circuito nuevo — `3_Cash_Flow` (36 refs, `SUMIFS Q por mes`) y `3_Dashboard`
  (4 refs: C4/C5 total, C6 cobrado, C20 check); equivalencias a definir (Q≈`Cert_Calculo!T`,
  cobrado≈`Cert_Facturacion`, mes≈`Cert_Calculo!F`); (2) ajustar el reader del dashboard web
  (`dashboard/reader/`) que la lee directo; (3) recién entonces eliminarla. Cambio estructural que
  toca output al cliente → checkpoint obligatorio.

### Dashboard nuevo (Design System "Industrial Integrity", `/ds`) — pendientes post-migración
Migración completa (2026-06-15): los 7 módulos andan en GDR y CH; el dashboard legacy (`/`, `/obra`)
sigue intacto. Ver `dashboard/CLAUDE.md` → "Design System — Industrial Integrity". Quedó para otra sesión:
- **Botones export / Descargar PDF**: inertes (placeholders visuales). Falta cablear la exportación.
- **Conectar los 3 slots WIP** cuando lleguen los datos: (1) EAC/Current Forecast, (2) curva de avance/
  desembolso planificado ("vs Planned"), (3) avance físico medido independiente de la certificación.
  Los slots ya están en la UI, listos para conectar el data source sin rediseñar.
- **Transición**: decidir si `/ds` reemplaza al legacy en `/` y `/obra/<code>`, o conviven un tiempo.
- (Opcional) unificar el estilo de cards del DS con el portfolio/detalle legacy.

### 2_Gastos CH — clasificación Rubro/MT-MO asistida por IA (revisar celdas amarillas)
Las columnas A (Rubro) y B (MT/MO) de `2_Gastos` fueron completadas por IA a partir de
"Desc Cuenta". Las celdas en **amarillo** requieren chequeo del usuario antes de dar el
control de presupuesto por válido. Detalle por descripción:

| Desc Cuenta | Asignado por IA | Confianza | A revisar |
|---|---|---|---|
| H. Seguridad e Higiene (5) | Seguridad e Higiene / MO | Media | ¿MO u honorarios? |
| Seguridad e Higiene (1) | Seguridad e Higiene / MT | Media | ¿MT o MO? |
| Preliminares (25) | Preliminar / MT | Media | ¿todos MT o hay MO? |
| Varios Ferreteria (12) | Gastos Generales Obra / MT | Media | ¿GG o rubro específico? |
| Obra civil Reforma (4) | Albañilería / MT | Baja | confirmar rubro |
| **Mov. Variables (24)** | Movilidad / MT | Revisar | 19 son YPF (combustible); los **5 no-YPF** pueden no ser Movilidad — spot-check |

### 2_Gastos CH — gastos fuera del Costo Controlable (A/B vacíos, marcados amarillo)
Por decisión de Pedro (2026-06-11):
- **Gastos en personal (5)** y **H. Gestoria (1)** → tratados como **indirectos**; A/B vacíos.
  Pendiente: definir si deben reflejarse en sección Gastos Indirectos de `3_Control_Ppto`.
- **Aguas (2)** → es **"Agua de obra" (Gasto Directo)**, no rubro Sanitaria; A/B vacíos.
  Pendiente: cablear estos gastos a la sección Gastos Directos de `3_Control_Ppto` (fila 46).

### 3_Control_Ppto CH — Gastos Indirectos: nombres A62-A64 sin match en 1_GGBB
Los labels actuales (`Payroll - Socios`, `Intereses Financiamiento`, `Payroll - Administración`)
no matchean ningún item de `1_GGBB`, así el XLOOKUP no trae presupuesto y el sanity check de la
fila 66 da **-94.164.834 ⚠**. Pendiente: confirmar con Arquinering los nombres definitivos
(candidatos: Admin, Seguros, IIBB, Imp cheque, Contrato) para que coincidan con col B de GGBB.

### Termomecánica — rubro CH no presente en el canónico CLAUDE.md
Pedro agregó el rubro **Termomecánica** (MT/MO) al control de CH (existía en 1_Presupuesto,
aportaba ~13M sin asignar). Es específico de CH. Pendiente: ver si se incorpora al listado
canónico del CLAUDE.md §5 o queda como rubro de obra. (Relacionado con la divergencia de abajo.)

### Divergencia de nomenclatura de Rubros CH vs canónico CLAUDE.md
El set de rubros de `3_Control_Ppto` de CH NO coincide con el listado canónico del CLAUDE.md
(ej.: "Electricidad" vs "Eléctrico"; "Durlock/Yeso", "Agrimensura", "Movilidad",
"Supervisión de Obra", "Mantenimiento" no figuran en el canónico). Para la migración de CH se
usa como fuente de verdad el set de Control_Ppto (es lo que matchean los SUMIFS).
Pendiente: confirmar con Pedro si el canónico del CLAUDE.md debe actualizarse o si CH es excepción.

### Versión prototipo `v8_5` (2026-06-18) — quincenas como movimientos (fuente única egresos)
Archivo **vigente** `archivos/output/CH_2171_Resumen_de_Obra_v8_5.xlsx` (clon de v8_4). Las quincenas
ahora son filas en 2_Movimientos; Control_Ppto y Cash_Flow leen una sola fuente (2_Movimientos).
2_Quincenas queda como staging (Control_Jornales lee sus horas). Items abiertos:
- **Nº de cuenta Tezamat para Eléctrico MO y Herrería MO**: las filas de quincena de esos 2 rubros
  quedaron con cuenta (col D) vacía (no había movimiento previo con esa cuenta). Pasar los nº de cuenta.
- Cuando 2_Quincenas tenga columna de ID de SC, las quincenas de obreros de subcontrato → Obs
  `CH-SC-XXX QUINCENA` (hoy ninguna fila de quincena es de SC).

### Versión prototipo `v8_4` (2026-06-18) — ingresos+egresos en 2_Movimientos
(Predecesora de v8_5.) Asume Tezamat alineado aguas arriba. Items a confirmar/accionar (datos Tezamat):
- **Tipo de movimiento de los pagos SC existentes**: se re-taggearon los 10 pagos como `AVANCE`
  (asumido — eran certificados de avance de subcontrato). Confirmar que ninguno es QUINCENA/CARGAS.
- **Cuentas Tezamat aún fuera del plan de rubros** (caen en sanity E102 = $8,5M): H. Seguridad e
  Higiene, Gastos Generales, Varios Ferretería, H. Gestoria, Gastos en personal, Seguridad e Higiene,
  Aguas. En el estado futuro Tezamat las emite con Desc Cuenta = token de rubro. Definir el mapeo.
- **Ingresos**: se asume que los movimientos del Fideicomiso (cta 410222, serie 4) son **cobros**.
  La fila "Ingresos por CAC" del Cash_Flow quedó en 0 (placeholder) hasta que Tezamat cargue el CAC
  de ingreso como movimiento separado (se sumaría por Observaciones `*CAC*` sobre INGRESO).
  Las métricas de certificación del Dashboard (C4 certificado base, C5 CAC) siguen en 0 → pertenecen
  a la versión de ingresos (circuito de certificación), no a los movimientos crudos.
- **Rubros extra fuera del set canónico de 17** (incluidos como filas debajo en Control_Ppto para que
  reconcilie): Agrimensura, Gastos Generales Obra, Termomecánica, Seguridad e Higiene, Supervisión de
  Obra, Mantenimiento + Herrería MO. Confirmar si entran al set oficial.
- **Maestros 0_Indice_CAC / 0_Jornales_MO**: dejados con nota de import (placeholder). Falta crear el
  archivo maestro externo y el script de importación (proceso Python, sin vínculo vivo).
- **Cols obsoletas A,B,U,V,W de 2_Movimientos**: vaciadas + marcadas (OBSOLETA), NO borradas físico
  (delete_cols corrompe refs por letra). Evaluar si se ocultan o se quitan (requiere reescribir refs).

> Nota: las ambigüedades de clasificación manual de 2_Gastos (sección "celdas amarillas" arriba)
> quedan **obsoletas en el prototipo**: la clasificación ya no se hace en el Resumen sino en Tezamat
> (origen). Aplican a v8_2/legacy, no a v8_3/v8_4.

---

## ✅ Resueltos

| Fecha | Ítem | Decisión tomada |
|-------|------|-----------------|
| 2026-06-11 | "Mov. Variables" en 2_Gastos CH | Mapear a **Movilidad / MT** (mayoría YPF/combustible) |
| 2026-06-11 | "Gastos en personal" y "H. Gestoria" | **Fuera del Costo Controlable** (indirectos), A vacío |
| 2026-06-11 | "Aguas" en 2_Gastos CH | Es **"Agua de obra" (gasto directo)**, no rubro Sanitaria |
| 2026-06-11 | Tabla en 2_Gastos CH | **No** crear `Tabla18`; CH usa referencias A1 (rangos columna completa) |
| 2026-06-12 | 2_Quincenas categoría rompía MATCH de MO | Renombrados `ESPEC`→`ESPECIALIZADO`, `1/2 OFIC`→`MEDIO OFICIAL` (coinciden con array/dropdown/Jornales) |
| 2026-06-12 | 0_Jornales_MO /hora eran valores | Convertidas G-J a fórmula `=IF(B="","",B/8)` (formula-pure, auto-calcula meses futuros) |
| 2026-06-13 | Dashboard CH ppto costo $1.109M vs ~$381M | **$1.109M es correcto**: el $381M era WIP incompleto (MO daba 0 sin rubros en 1_Presupuesto C/D). Pedro los cargó; sanity check Δ=0 ✓ valida el número |
| 2026-06-13 | EQ y Prov en el costo controlable | **Excluidos** (EQ = depreciación, solo precio venta; Prov no aplica). CLAUDE.md §11 |
| 2026-06-13 | % avance por etapa inflado (venta÷costo) | Corregido a **venta vs venta**; el mix ×1,3565 inflaba el avance |
| 2026-06-13 | GDR atrás del estándar mejorado de CH | **Retrofit aprobado**: portar fórmulas dinámicas, checks, exclusión EQ, fix avance, CONFIG auditable a GDR |
| 2026-06-14 | Conversión profunda A — costos `1_Presupuesto` GDR total vs CH unidad | **Ejecutada**: GDR convertido a por-unidad (estándar único cross-obra), value-preserving (Δ máx 1,19e-7). Backup `_bak_GDR_pre_conversionA.xlsx`. Ver memoria [[costos-1presupuesto-por-unidad]] |
