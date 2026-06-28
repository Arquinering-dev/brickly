# PROMPT — Migrar GDR (García del Río 3760) a la estructura v8 (Excel-DB)

> Pegá este prompt para arrancar la sesión de migración de GDR. Es autosuficiente: leé los archivos
> que indica antes de tocar nada. El modelo a replicar es **CH 2171 v8_11** (ya terminado).

---

## Objetivo
Llevar el Resumen de Obra de **GDR (García del Río 3760)** a la **estructura v8 nueva (Excel = base de
datos)**, la misma que tiene CH 2171 en `archivos/output/CH_2171_Resumen_de_Obra_v8_11.xlsx`, pero en su
forma **"limpia"**: sin las hojas que pasan a **maestros cross-obra** ni las hojas de **análisis** (que ya
viven en el dashboard web). GDR es la obra que faltaba acondicionar (sigue en la estructura v8 "clásica").

## Modo de trabajo (IMPORTANTE — leer)
Trabajá **interactivo y por bloques**, no de una pasada:
1. Primero hacé el **inventario de GDR** (bloque 1) y mostrame qué encontrás vs CH.
2. Hay una sección **"Decisiones abiertas"** abajo con preguntas numeradas (Q1…Q8). **No las asumas.**
   Antes de ejecutar el bloque que cada pregunta dispara, **hacémela** (una por vez, en el momento que
   corresponde) y esperá mi respuesta. Si una respuesta cambia el alcance, re-planteá antes de seguir.
3. Para cada bloque: describí qué vas a hacer → si es estructural, esperá mi OK → ejecutá → `recalc.py`
   0 errores → reportá brevemente → seguí. Un único `wb.save()` por bloque.
4. Registrá cada decisión que tomemos en `CLAUDE.md` §11 y el avance en `logs/`.

## Leer antes de tocar nada (en este orden)
1. `CLAUDE.md` — contexto maestro (dominio, plan de cuentas Tezamat, principios técnicos, decisiones).
2. `logs/pendientes.md` — pendientes; en especial **"Maestros cross-obra"** (CAC, jornales, subcontratos).
3. `logs/sesion_2026-06-19.md` — cómo se construyó CH paso a paso (addendum Cert_*, conciliación, bloques,
   2_Gastos_DirInd, separación de anticipo, auditoría). Es el playbook real.
4. `docs/HANDOFF_flujo_resumen_v8.md` + `dashboard_v2/LOGICA_CALCULO_v8.md` — el flujo y el contrato de datos.
5. `dashboard_v2/specs/ESPEC_Circuito_Certificacion_v8.md` y `docs/SPEC_Conciliacion_Movimientos_v8.md`.

## Archivos
- **Modelo (replicar):** `archivos/output/CH_2171_Resumen_de_Obra_v8_11.xlsx`.
- **Fuente GDR (estructura vieja, NO modificar — es la referencia maestra):**
  `archivos/referencia/GDR_3760_Resumen_de_Obra_v8.xlsx`.
- **APU Unificado de GDR (provee la hoja `1_Composicion`):** `archivos/referencia/APU_Unificado_GDR3760_VF_6.xlsx`.
- **Scripts de CH reutilizables (adaptar a GDR):** `scripts/aplicar_plan_cuentas_ch.py`,
  `scripts/reestructurar_gastos_dirind.py`, `scripts/addendum_cert_ingresos.py`,
  `scripts/cargar_cert_reales_oc01.py`, `scripts/spec_conciliacion_movimientos.py`.
- **Validación:** `scripts/recalc.py` (0 errores) + `scripts/excel_recalc.py` (recálculo real + cacheo).
- **Salida:** copia de trabajo `archivos/output/GDR_3760_Resumen_de_Obra_v8_X.xlsx` (NO tocar la referencia).

## Definiciones confirmadas por Pedro
- El resumen de obra **NO lleva**: `0_Indice_CAC`, `0_Jornales_MO` (tarifas), `2_Subcontratos` (maestro)
  → pasan a **maestros cross-obra** (ver pendiente). Tampoco las **hojas de análisis** (3_Dashboard,
  3_Control_Ppto, 3_Control_Jornales, 3_Control_Subc, 2_Certificaciones vieja) → viven en el **dashboard**.
- `1_Presupuesto` debe tener los **rubros del plan de cuentas Tezamat** (4 columnas A/B/C/D, dropdowns
  `RUBROS_PLAN`, sanity checks rubro∈plan).
- `2_Movimientos`: las referencias/observaciones correctas las carga **Arquinering** (extracto corregido de
  Tezamat) → **NO es el foco ahora**; dejar la estructura lista para recibir ese extracto.
- **Reestructurar `2_Gastos_DirInd`** a tabla plana (`Fecha | Tipo | Concepto | Monto` + dropdowns), como CH v8_11.
- **Crear las hojas del flujo de certificaciones** (`Cert_OC_Cliente`, `Cert_App_Output`, `Cert_Calculo`,
  `Cert_Cabecera`, `Cert_Facturacion`, `Cert_Control_OC`) + el reenganche en `1_Presupuesto` (AC = SUMIFS
  desde Cert_App_Output por clave compuesta presupuesto+código; dimensión `AQ`).

## Trabajo a hacer (orden sugerido, un bloque por vez → recalc → seguir)
1. **Inventario de GDR**: hojas actuales, layout, y diferencias con CH (⚠ GDR y CH **difieren en filas/wording**
   — usar lectura anclada/`LAYOUT` por hoja, nunca asumir la posición de CH).
2. **`1_Presupuesto`**: alinear rubros al plan de cuentas Tezamat (rama 53 OBRA), 4 columnas, dropdowns +
   sanity, value-preserving. (GDR ya está en **costos por-unidad** — Conversión profunda A, 2026-06-14.)
3. **`1_Composicion`**: traer del APU Unificado de GDR (trabajo ya hecho por el compañero).
4. **`1_GGBB`**: presupuesto de gastos generales/directos/indirectos (columna G = "por fuera de obra").
5. **`2_Gastos_DirInd`**: reestructurar a tabla plana.
6. **`2_Movimientos`**: dejar la estructura/columnas lista (placeholder hasta el extracto de Tezamat).
7. **Circuito `Cert_*`**: crear las 6 hojas + reenganche en `1_Presupuesto`. Necesita los datos de OC-Cliente
   de GDR (ver "a resolver").
8. **Eliminar** las hojas que no van (análisis 3_*, 2_Certificaciones vieja, y las que pasan a maestro — con
   la salvedad de CAC, ver "a resolver").
9. **Validar**: `recalc.py` 0 errores + `excel_recalc.py`.
10. **Sumar GDR al dashboard**: `dashboard_v2/config/obras.yaml` + soltar el `.xlsx` en `dashboard_v2/data/`.
    Verificar que el reader (lectura anclada por texto) lo absorbe → **portfolio multi-obra real** (el payoff).

## Decisiones abiertas — PREGUNTÁ a Pedro (no asumas)
Estas son decisiones que no están cerradas. **Hacé cada pregunta en el momento que la dispara** (no todas
juntas al principio), esperá la respuesta y recién entonces ejecutá ese bloque. Si la respuesta cambia el
alcance, re-planteá.

- **Q1 — CAC (⚠ la más importante; dispara: antes del bloque 8 "eliminar hojas", y afecta el bloque 7).**
  Sacar `0_Indice_CAC` del archivo **rompe las fórmulas formula-pure del circuito `Cert_*`** (el ratio CAC se
  calcula leyendo `0_Indice_CAC!B` dentro del archivo; no se permiten links vivos entre archivos). Pregunta:
  *¿Mantenemos un `0_Indice_CAC` local en cada resumen como copia sincronizada del maestro (lo más viable), o
  sacamos la deflactación CAC de las fórmulas?* Resolver ANTES de eliminar la hoja. (Idem: revisar si algo
  depende de `0_Jornales_MO` antes de sacarla.)
- **Q2 — `0_CONFIG` de GDR (dispara: al armar el CONFIG).** *¿Cuáles son los parámetros propios de GDR — mes
  base CAC, coeficiente K, y apertura fiscal?* (CLAUDE.md indica GDR = **B70/N30/GGN**, distinta de CH
  B65/N35/GDN — confirmar.) El CONFIG debe quedar auditable (B16/B17/B18 = SUMPRODUCT desde `1_Presupuesto`).
- **Q3 — OC-Cliente de GDR (dispara: bloque 7, `Cert_*`).** *¿Cuántas OC/presupuestos tiene GDR, y por cada
  una: monto, % anticipo, mes base CAC, % IVA, % desacopio sugerido?* Sin esto no se puede armar
  `Cert_OC_Cliente`. (Es dato de Arquinering.)
- **Q4 — Avance físico real de GDR (dispara: bloque 7, `Cert_App_Output`).** *¿Hay un documento de
  certificaciones de GDR (como el de CH OC01) con el % de avance por tarea?* Si no, `Cert_App_Output` queda
  como placeholder hasta tenerlo.
- **Q5 — `2_Quincenas` / horas (dispara: al definir la estructura de hojas).** Las horas trabajadas pasan a
  maestro cross-obra (pendiente). *¿GDR lleva una `2_Quincenas` local temporal, o se omite?* (Sin ella, la
  vista de Jornales del dashboard queda sin datos para GDR hasta el maestro.) ⚠ Si se carga, **NO cablear sus
  columnas de costo** (doble conteo con `2_Movimientos`).
- **Q6 — `2_Subcontratos` / maestro (dispara: al definir la estructura de hojas).** Mientras el maestro
  cross-obra no exista, *¿GDR lleva un `2_Subcontratos` local temporal o se omite?* (Afecta la vista de
  Subcontratos del dashboard para GDR.)
- **Q7 — Reader del dashboard (dispara: bloque 10).** El reader se construyó/probó sobre CH; GDR puede tener
  wording/layout distinto. Verificar que la lectura anclada por texto lo absorbe (rubros, headers, banners,
  totales) y, si algo no matchea, proponer ajustes menores en `dashboard_v2/reader/` (consultar antes de tocar).
- **Q8 — Rubros de GDR vs plan de cuentas (dispara: bloque 2, `1_Presupuesto`).** Pueden existir rubros de GDR
  que no matcheen el plan de cuentas Tezamat. Listarlos y *preguntar el mapeo* (no asumir); documentar en
  `logs/pendientes.md`.

## Principios (heredados — no negociables)
Formula-pure (sin valores pegados sobre fórmulas, sin macros); Excel 2016+ (XLOOKUP; `_xlfn.` para
XLOOKUP/MAXIFS en openpyxl); nada de `delete_rows`/`insert_rows` (filas nuevas al final); checkpoint antes de
cambios estructurales; registrar decisiones en `CLAUDE.md` §11 y avances en `logs/`.
