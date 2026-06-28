# CLAUDE.md — Ecosistema Resumen de Obra (Excel-DB + Dashboard + App de Certificación)
# Arquinering S.R.L. — Buenos Aires

> Este archivo es el contexto de arranque para Claude Code.
> Leerlo completo antes de ejecutar cualquier acción.
>
> **Cambio de paradigma (jun-2026).** El proyecto nació como *migración* de los Resúmenes de
> Obra al formato v8 y mutó a *construir el ecosistema*: el Excel deja de ser un "360" (recopilar
> datos **y** analizar) y pasa a ser una **base de datos** (fuente de verdad, formula-pure,
> auditable con `recalc.py`); el análisis y la visualización viven en un **dashboard web**
> (`dashboard_v2/`) que recalcula leyendo las hojas fuente crudas; y un **circuito/app de
> certificación** (`Cert_*`) maneja los ingresos. Documento rector del flujo completo:
> `docs/HANDOFF_flujo_resumen_v8.md`. La carpeta conserva el nombre `arquinering-migracion` por
> historia, pero el alcance ya no es "migrar".

---

## 1. DOMINIO DEL PROYECTO

### Empresa y contexto
Arquinering S.R.L. es una constructora y desarrolladora inmobiliaria argentina que opera bajo
estructura de **fideicomiso inmobiliario**: los inversores (fiduciantes) aportan capital a un
administrador (fiduciario) que financia la construcción. Arquinering ejecuta la obra Y administra
los fondos del fideicomiso simultáneamente.

### Conceptos clave del dominio

**APU — Análisis de Precio Unitario**
Archivo Excel maestro (~102 hojas) que descompone cada tarea de obra en materiales (MAT),
mano de obra (MO) y equipos (EQ). Es la fuente de verdad de costos. Tiene tablas maestras de
Materiales, Mano de Obra UOCRA y Equipos. Versiones: `ARQING_APU_1224.xlsx` (dic-2024,
referencia GDR) y `ARQING_APU_0625.xlsx` (jun-2025, referencia CH).

**CAC — Índice de Costo Argentino de la Construcción**
Publicado mensualmente por INDEC. Permite comparar pagos de distintos meses en moneda
constante (deflactación). Fórmula: `monto_base = monto_pagado / (CAC_mes_pago / CAC_mes_base)`.

**UOCRA — Unión Obrera de la Construcción de la República Argentina**
Sindicato que regula el convenio colectivo de trabajo. Las categorías de personal propio se
rigen por sus escalas salariales (capataz, oficial, medio oficial, ayudante).

**Fideicomiso**
Estructura legal donde los fondos son de los inversores. Arquinering certifica avance y factura
al fideicomiso para cobrar. Los certificados se ajustan por CAC.

**Rubro**
Agrupación de tareas afines: Hormigón, Albañilería, Eléctrico, Sanitaria, Pintura, etc.
Es la unidad de control presupuestario.

**Resumen de Obra (v8 = base de datos)**
Archivo Excel formula-pure que es la **fuente de verdad** de la obra: presupuesto aprobado,
composición, movimientos (ingresos+egresos), subcontratos, quincenas y circuito de certificación.
Ya **no** contiene las hojas de análisis (`3_*`): esos KPIs los recalcula el dashboard web.

**Tezamat — sistema contable; única fuente de egresos**
Software de gestión contable de Arquinering. **Toda salida de dinero** (compras, pagos a
subcontratos, nómina/quincenas) se carga en Tezamat y se exporta (Libro Mayor por centro de
costo = obra) a la hoja `2_Movimientos`. No hay doble fuente de egresos.

**Plan de Cuentas Tezamat = fuente de verdad de los rubros**
El plan contable (`archivos/fuente/AING - Plan de Cuentas.xlsx`) manda sobre la nomenclatura de
rubros. La **rama 53 OBRA** = rubros de obra (con split `MT`/`MO` en el nombre); ramas `50/51/52`
= indirectos; `41/42` = ingresos. El cruce presupuesto↔gasto se hace por **código de cuenta**, no
por texto. Las celdas de rubro del Excel son **dropdowns** (data validation, nombre definido
`RUBROS_PLAN`) con sanity checks que validan que todo rubro de tarea ∈ plan. Ver memoria
`plan-cuentas-tezamat-rubros`.

**Regla de los 4 rubros del presupuesto (crítica)**
Arquinering no usa código WBS: cada factura se imputa a una sola cuenta de rubro, y el rubro de la
compra de materiales de una tarea **no siempre coincide** con el de las quincenas de esa tarea (el
Jefe de Obra reporta horas por rubro/etapa, no por tarea). Por eso, al cerrar el presupuesto se
asigna un rubro **por cada tipo de costo**: materiales, provisiones, MO subcontratada, MO interna
(cols A/B/C/D de `1_Presupuesto`). La MO interna (MO/ALB) mapea a `Preliminares` para control.
Detalle: `docs/HANDOFF_flujo_resumen_v8.md` §2.

### Obras activas
| Obra | Código | Estado | Archivo vigente |
|------|--------|--------|-----------------|
| García del Río 3760 | GDR | **v8_13 (2026-06-24)**: `1_Presupuesto` estandarizado al layout único (venta=input por tarea, avance reducido a `% Acum Tot`). Antes: v8_12 (plan ctas Tezamat, `Cert_*` 3 OC, `2_Movimientos` placeholder, `2_Gastos_DirInd` plana, legacy eliminada). **El dashboard lo lee** → portfolio multi-obra | `archivos/output/GDR_3760_Resumen_de_Obra_v8_13.xlsx` (ref: `archivos/referencia/GDR_3760_Resumen_de_Obra_v8.xlsx`) |
| Chivilcoy 2171 | CH | **v8_12 (2026-06-24)**: `1_Presupuesto` estandarizado al layout único (migrado desde el layout viejo; venta=input por tarea, avance=`% Acum Tot`). Antes: v8_11 (`2_Gastos_DirInd` plana, avance real OC01). **El dashboard lee v8_12** | `archivos/output/CH_2171_Resumen_de_Obra_v8_12.xlsx` |
| El Salvador 4140 | SVD | **v8_2 (2026-06-24)**: `1_Presupuesto` estandarizado al layout único. Antes: v8_1 (migrado legacy→v8; 3 OC, 191 tareas, venta=input por tarea, avance 62,8%, Tezamat 319 mov). **El dashboard lo lee** → portfolio 3 obras. Pendientes de datos: cobros, quincenas (M.O.), OC03 avance, tagueo SC | `archivos/output/SVD_4140_Resumen_de_Obra_v8_2.xlsx` |

---

## 2. OBJETIVO DEL PROYECTO

Construir y mantener el **ecosistema de control de obra** de Arquinering, con tres capas:

1. **Excel v8 = base de datos** (Python + openpyxl). Fuente de verdad por obra: presupuesto,
   composición, movimientos, subcontratos, quincenas, circuito `Cert_*`. Debe ser:
   - **formula-pure** (ninguna celda de fórmula tiene valor pegado),
   - **auditable** (cada resultado se rastrea hasta su fuente),
   - **Excel 2016+** (XLOOKUP disponible),
   - **0 errores de fórmula** al recalcular (`recalc.py`).
2. **Dashboard web (`dashboard_v2/`)** = capa de análisis/visualización. Lee el Excel y
   **recalcula los KPIs** desde las hojas fuente crudas (no consume valores pre-calculados).
   Contrato de cálculo: `dashboard_v2/LOGICA_CALCULO_v8.md`.
3. **Circuito / app de certificación (`Cert_*`)** = ingresos. Carga de avance del Jefe de Obra →
   certificación → partición fiscal (con/sin factura) → facturación y cobro. Spec:
   `dashboard_v2/specs/ESPEC_Circuito_Certificacion_v8.md`.

CH es la obra de referencia del estado nuevo (v8_7). GDR es la referencia maestra histórica y
queda pendiente de acondicionar al mismo estándar. La migración de formato legacy→v8 (lo que
originó el proyecto) está **esencialmente completa**; el material de esa etapa vive en `_archivo/`.

---

## 3. PRINCIPIOS TÉCNICOS NO NEGOCIABLES

### Formula-pure
**Nunca** pegar valores sobre celdas que deben ser fórmula.
**Nunca** usar `ws.cell.value = número` donde debería haber una fórmula Excel.
Si hay que actualizar un precio, se actualiza en la tabla maestra, no en cada celda que lo usa.

### Sin macros
El archivo final no tiene macros VBA ni código embebido. Todo el procesamiento es Python externo.

### Excel 2016+ con XLOOKUP disponible
- ✅ XLOOKUP, SUMIFS, COUNTIFS, IFERROR, LET (Excel 365 / 2021+) → usar con libertad
- ✅ XLOOKUP → preferido sobre VLOOKUP para nuevas fórmulas
- ⚠️  Evitar funciones exclusivas de Excel 365 beta que no estén en el listado anterior
- Todas las fórmulas se escriben en inglés (Excel argentino puede estar en español, pero
  openpyxl siempre escribe en inglés y Excel las traduce al abrir)

### Batch saves
Todos los cambios de un bloque lógico van en un único `wb.save()`.
**Nunca** guardar archivos parciales en el medio de un bloque.
Después de cada `wb.save()`, ejecutar `scripts/recalc.py` y verificar 0 errores antes de continuar.

### Integridad de referencias
Antes de insertar o eliminar filas, verificar qué rangos SUMIFS/XLOOKUP las incluyen.
Preferir **append al final** sobre insertar en el medio. Nunca usar `delete_rows()` en hojas
que tienen fórmulas que referencian filas por número absoluto.

### Checkpoint antes de ejecutar
Para cualquier cambio estructural (nueva hoja, nueva columna, cambio de rango):
1. Describir qué se va a modificar y qué fórmulas se ven afectadas
2. Esperar confirmación explícita antes de ejecutar
Para cambios menores (actualizar un valor, corregir una fórmula puntual): ejecutar directo.

---

## 4. COLOR CODING ESTÁNDAR DE CELDAS (v8)

El estándar v8 codifica el **significado en el COLOR DE LA FUENTE** (convención de modelos
financieros), no en el relleno. El relleno se reserva para el chrome (título, header, sección,
alerta). Implementación de referencia: `scripts/formato_v8.py`. Regla operativa:

| Tipo | Color de fuente | Relleno | Cómo se detecta |
|------|-----------------|---------|-----------------|
| Input manual | 🔵 Azul `FF0000FF` | — (o input `DDEEFF`) | Columnas de input (oráculo: celdas azules en GDR) o relleno `DDEEFF` |
| Fórmula / cálculo | 🟢 Verde `FF008000` | — | La celda empieza con `=` |
| Dato importado / estático | ⚫ Negro `FF000000` | — | Todo lo demás (NO usar gris — el gris legacy se convierte a negro) |
| Pendiente / Alerta | 🔴 Rojo `FFFF0000` | Amarillo `FFFF99` | Relleno amarillo |
| Encabezado de columna | ⚪ Blanco **bold** centrado | Azul oscuro `1F4E78` | Fila `header_row` de cada hoja |
| Título de hoja | Azul oscuro `1F3864` **bold** | Celeste `D6E4F0` | Fila `title_row` (barra a lo ancho) |
| Banner de sección | ⚪ Blanco **bold** | Azul oscuro `1F4E78` | Celda cuyo valor empieza con `▌` |

Reglas de prioridad (en este orden): fórmula → verde · relleno amarillo → rojo · input → azul ·
resto → negro. Las filas `title_row`/`header_row` se estilizan aparte (no entran a la regla).

**Chrome de hoja:** fuente unificada **Aptos Narrow**, gridlines ocultas, freeze en la fila de
datos, color de pestaña por sección (0_=amarillo, 1_=gris oscuro, 2_Gastos*=naranja,
Subcontratos/Pagos=azul, Certificaciones=verde, 3_=azul oscuro). El layout (fila de
título/header/datos) de cada hoja está en el dict `LAYOUT` de `formato_v8.py`, NUNCA se asume
por la posición de GDR (CH y GDR difieren en filas en varias hojas).

```python
# Aplicar formato estándar v8 a un archivo de obra (usa GDR como referencia de inputs/anchos):
#   python scripts/formato_v8.py archivos/output/<obra>_v8.xlsx
# Recordar: correr formato SOBRE una base limpia (estructura ya correcta), luego recalc.
```

---

## 5. NOMENCLATURA CANÓNICA

### Rubros (Title Case con tildes — exactamente como figura aquí)
```
Hormigón
Albañilería
Revoque
Cielorraso
Revestimiento
Pisos
Pintura
Carpintería
Herrería
Vidriería
Eléctrico
Sanitaria
Gas
Pluvial
Aislaciones
Impermeabilización
Granito
Varios
Gastos Generales
```

> ⚠️ Respetar tildes y mayúsculas iniciales. "albanileria" o "ALBANILERIA" son incorrectos.
> Si un rubro del archivo legacy no está en esta lista, documentar en `logs/pendientes.md`
> antes de mapear.

### Categorías MO — UOCRA (UPPERCASE)
```
CAPATAZ
OFICIAL
MEDIO OFICIAL
AYUDANTE
JEFE DE OBRA
```

### Tipos de costo (columnas en COMPOSICIÓN / PARTIDAS)
- `MAT` — Materiales
- `MO` — Mano de Obra
- `EQ` — Equipos
- Subtipos MAT: `COR` (corralón), `OTR` (otros/especiales)
- Subtipos MO: `ALB` (personal UOCRA nómina propia), `OTR` (subcontrato)

### Prefijos de códigos de partidas
| Prefijo | Tipo |
|---------|------|
| `ALB-`, `REV-`, `CER-`, `DUR-`, `PIN-`, etc. | Partidas APU por rubro |
| `PTO-NNNN` | Ítems del presupuesto sin alias APU |
| `MO-XXX` | Categorías UOCRA (MO-OFA, MO-AYU01, etc.) |
| `SUB-XXX` | Subcontratos catalogados |
| `EQ-XXXXXX` | Equipos del catálogo |
| `MAT-CONS` | Consumibles (precio siempre = 1) |

---

## 6. ARCHIVOS DEL PROYECTO

```
arquinering-migracion/
├── CLAUDE.md                          ← Este archivo (leer siempre al arrancar)
├── archivos/
│   ├── fuente/                        ← Originales sin modificar (solo lectura)
│   │   ├── AING - Plan de Cuentas.xlsx       ← Plan de cuentas Tezamat (fuente de rubros)
│   │   ├── CH 2171_Pres 02.xlsx              ← Presupuesto CH (fuente de cantidades)
│   │   ├── ARQING - APU 06-25.xlsx           ← APU jun-2025 (referencia CH)
│   │   ├── ARQING - APU 12-24.xlsx           ← APU dic-2024 (referencia GDR)
│   │   ├── Chivilcoy 2171 - Resumen de obra.xlsx ← Resumen CH legacy
│   │   └── GDR 3760 - Resumen de Obra 6-may.xlsx ← Resumen GDR legacy
│   ├── referencia/                    ← Modelos que NO se modifican
│   │   ├── GDR_3760_Resumen_de_Obra_v8.xlsx  ← Resumen GDR v8 (REFERENCIA MAESTRA)
│   │   ├── APU_Unificado_GDR3760_VF_6.xlsx   ← APU Unificado GDR (fórmulas modelo)
│   │   └── APU_Unificado_CH2171_v5_1.xlsx    ← APU Unificado CH
│   └── output/                        ← Archivos de trabajo (no se versionan)
│       └── CH_2171_Resumen_de_Obra_v8_7.xlsx ← CH VIGENTE (Tezamat crudo + Cert_* + plan ctas)
├── dashboard_v2/                      ← Dashboard web vigente (Flask + JS; recalcula del Excel)
│   ├── app.py · config/obras.yaml · data/ ← apunta a CH v8_7
│   ├── reader/                        ← motor: movimientos, cert, drilldown, lectura anclada
│   ├── web/                           ← front Design System "Industrial Integrity"
│   ├── design/                        ← DESIGN_SYSTEM.md + mockups Stitch
│   ├── specs/ESPEC_Circuito_Certificacion_v8.md ← spec del circuito Cert_*
│   ├── LOGICA_CALCULO_v8.md           ← contrato de cálculo del motor
│   ├── CLAUDE.md                      ← contexto del dashboard (heredado del v1, con nota)
│   └── README.md
├── scripts/
│   ├── recalc.py                      ← Verificación post-save: cuenta errores de fórmula
│   ├── excel_recalc.py · utils.py     ← recálculo COM (Windows) + auxiliares
│   ├── formato_v8.py · estandarizar_v8.py    ← formato/estructura estándar v8
│   ├── aplicar_plan_cuentas_ch.py · reconciliar_plan_cuentas.py · relevamiento_tezamat.py
│   └── migracion_egresos_v3/v4/v5.py  ← construcción de 2_Movimientos (histórico reutilizable)
├── docs/
│   ├── HANDOFF_flujo_resumen_v8.md    ← DOCUMENTO RECTOR del flujo punta a punta
│   ├── Playbook_Migracion_..._v1.1.docx · Resumen_de_Obra_Manual_de_Uso_v8.docx
│   ├── APU_Unificado_Manual_Tecnico_v3.docx
│   └── Reconciliacion_Plan_Cuentas_CH2171.md · Relevamiento_Tezamat_CH2171.md
├── logs/                              ← sesion_YYYY-MM-DD.md + pendientes.md
├── memory/                            ← memoria persistente de Claude (MEMORY.md + fichas)
└── _archivo/                          ← Material superado (gitignored; ver _archivo/README.md)
```

### Roles de cada archivo

| Archivo | Rol | Modificable en sesión |
|---------|-----|-----------------------|
| `archivos/fuente/*` | Fuentes originales, solo lectura | ❌ Nunca |
| `archivos/referencia/GDR_3760_Resumen_de_Obra_v8.xlsx` | Referencia maestra v8 | ❌ Nunca |
| `archivos/referencia/APU_Unificado_*.xlsx` | Fuente de composiciones y precios | ❌ Nunca |
| `archivos/output/*` | Resúmenes de obra de trabajo (CH v8_7 vigente) | ✅ Sí |
| `dashboard_v2/*` | Dashboard web (reader, web, config) | ✅ Sí (ver `dashboard_v2/CLAUDE.md`) |
| `scripts/recalc.py` | Script de validación (no modificar sin aviso) | ⚠️ Solo con aviso |
| `_archivo/*` | Material archivado, solo consulta | ❌ No reactivar sin aviso |

---

## 7. SCRIPT recalc.py — USO Y COMPORTAMIENTO

`recalc.py` es el verificador post-save obligatorio. Abre el archivo con `data_only=False`,
recorre todas las hojas y reporta celdas con fórmulas que retornan error.

```bash
# Uso estándar después de cada wb.save()
python scripts/recalc.py archivos/output/CH_2171_v8_WIP.xlsx

# Salida esperada (OK):
# ✅ 0 errores de fórmula — archivo listo para continuar

# Salida con errores:
# ❌ 3 errores encontrados:
#    Hoja: Control_Ppto | Celda: D45 | Fórmula: =SUMIFS(...) | Error: #REF!
#    Hoja: Dashboard    | Celda: B12 | Fórmula: =XLOOKUP(...)| Error: #NAME?
#    ...
```

**Regla crítica**: Si `recalc.py` reporta cualquier error, **detener el trabajo** y resolver
antes de continuar. No acumular errores para resolver "al final".

---

## 8. WORKFLOW ESTÁNDAR DE SESIÓN

### Al arrancar
1. Leer este CLAUDE.md completo
2. Revisar `logs/pendientes.md` para ver ítems abiertos de sesiones anteriores
3. El usuario describe el objetivo de la sesión
4. Antes de tocar ningún archivo: hacer `ls archivos/output/` para ver el estado actual
5. Identificar el archivo WIP (Work In Progress) de la sesión

### Durante el trabajo
```
Para cada bloque de cambios:
  1. Describir qué se va a hacer y qué celdas/rangos se afectan
  2. Si es cambio estructural → esperar confirmación explícita
  3. Ejecutar el bloque
  4. wb.save() al finalizar el bloque
  5. python scripts/recalc.py [archivo]
  6. Si hay errores → resolver AHORA antes de continuar
  7. Si 0 errores → reportar brevemente qué se hizo y continuar
```

### Al cerrar la sesión
1. Ejecutar `recalc.py` final sobre el archivo output
2. Confirmar 0 errores de fórmula
3. Actualizar `logs/sesion_YYYY-MM-DD.md` con:
   - Qué se completó
   - Qué quedó pendiente
   - Cualquier decisión tomada que afecte sesiones futuras
4. Actualizar `logs/pendientes.md` si hay nuevos ítems abiertos

---

## 9. PATRONES PYTHON ESTÁNDAR

### Apertura de archivos
```python
import openpyxl

# Para leer fórmulas (trabajo normal)
wb = openpyxl.load_workbook("archivos/fuente/archivo.xlsx")

# Para leer valores calculados (auditoría, comparación)
wb_vals = openpyxl.load_workbook("archivos/fuente/archivo.xlsx", data_only=True)

# Nunca mezclar data_only=True con escritura de fórmulas
```

### Escritura de fórmulas
```python
# Correcto: escribir la fórmula como string con = adelante
ws["B5"] = '=SUMIFS(Pagos!D:D, Pagos!A:A, "Hormigón")'

# Incorrecto: pegar el valor calculado
ws["B5"] = 1250000  # ❌ si debe ser una fórmula
```

### Colores (PatternFill)
```python
from openpyxl.styles import PatternFill, Font, Alignment

def aplicar_color(ws, celda, tipo):
    colores = {
        "input":    "DDEEFF",
        "ref_ext":  "DDFFDD",
        "formula":  "FFFFFF",
        "estatico": "F2F2F2",
        "pendiente":"FFFF99",
    }
    ws[celda].fill = PatternFill("solid", fgColor=colores[tipo])
```

### Manejo de CAC
```python
# El CAC se toma de la hoja CONFIG del Resumen de Obra
# Nunca hardcodear el valor de CAC en el código Python
# La fórmula de deflactación va EN la celda Excel, no en el script

# Ejemplo de fórmula Excel para deflactar un pago:
formula_deflactar = '=D{row} / (XLOOKUP(C{row}, CONFIG!$A:$A, CONFIG!$B:$B) / CONFIG!$B$2)'
```

---

## 10. CONVENCIONES DE LOGGING

### Formato de entrada en logs/sesion_YYYY-MM-DD.md
```markdown
## Sesión YYYY-MM-DD

### Objetivo
[Descripción breve de lo que se buscaba lograr]

### Completado
- [x] Ítem 1 completado
- [x] Ítem 2 completado

### Pendiente para próxima sesión
- [ ] Ítem 3 — requiere confirmación de Pedro sobre [X]

### Decisiones tomadas
- **Rubro "Varios" en CH**: se mapea desde columna "Otros" del legacy (confirmado)
- **Coeficiente de cargas UOCRA**: usar 1.58 (valor del archivo APU 0625)

### Errores encontrados y resueltos
- Error #REF! en Control_Ppto D45: rango SUMIFS no cubría filas nuevas → extendido a fila 500
```

---

## 11. DECISIONES PREVIAS DOCUMENTADAS

> Actualizar esta sección cuando se toman decisiones que afectan criterios futuros.

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 2026-06-12 | Color coding v8 por **color de fuente** (azul=input, verde=fórmula, negro=dato), no por relleno | Es la convención real de GDR; el relleno se reserva para chrome (header/título/sección/alerta) |
| 2026-06-12 | Gris legacy → **negro** para todos los datos | El gris (35k celdas en CH) era artefacto del volcado legacy, no estándar v8 |
| 2026-06-12 | Layout por hoja en `formato_v8.py` (`LAYOUT`), NO asumir posición de GDR | CH y GDR difieren en filas (CH sin filas de título en varias hojas) |
| 2026-06-12 | Reestructura de filas solo donde es seguro (híbrido); no mover hojas muy acopladas | `1_Presupuesto`/`2_Gastos_DirInd` tienen 60-90+ refs por fila absoluta; openpyxl no reajusta fórmulas |
| 2026-06-12 | `2_Gastos` CH usa referencias A1, **no** tabla `Tabla18` | Todas las hojas de CH agregan con rangos de columna completa, no con tabla estructurada |
| 2026-06-12 | Rubros válidos = los de `3_Control_Ppto` de la obra, no el canónico genérico | Los SUMIFS matchean contra ese set (CH usa "Electricidad", "Durlock/Yeso", etc.) |
| 2026-06-12 | Tipos fiscales CH = `B65/N35/GDN` (no `B70/N30/GGN` de GDR) | Cada obra tiene su apertura fiscal propia |
| 2026-06-13 | **EQ (equipos) y Prov se EXCLUYEN del Costo Controlable** | EQ es depreciación que solo impacta precio de venta, no se controla contra gasto real; Prov no aplica |
| 2026-06-13 | `3_Control_Ppto` con **fórmulas dinámicas** `IF($B="MT",…,IF($B="MO",…))` replicables, no hardcodeadas por fila | Mantenibilidad: una sola fórmula por columna, copiable hacia abajo |
| 2026-06-13 | Presupuestado controlable = `SUMPRODUCT` sobre 1_Presupuesto (MT→col A×K, MO→col C×L + col D×M) | Auditable directo desde la fuente; exige rubros cargados en C/D de 1_Presupuesto |
| 2026-06-13 | **% Avance por etapa = venta vs venta** (cert PV ÷ ppto PV), no venta÷costo | El bug venta/costo (×1,3565) inflaba el avance; corregido a "manzanas con manzanas" |
| 2026-06-13 | `0_CONFIG` B16/B17/B18 = fórmulas `SUMPRODUCT` desde 1_Presupuesto (auditables), no apuntar a celdas únicas | B17 apuntaba a una celda unitaria (~248M) = bug crítico; ahora costo total real |
| 2026-06-13 | **Sanity checks** embebidos en `3_Control_Ppto` (Δ ppto rubros/directos/indirectos/etapas + costo sin rubro), indicador ✓/⚠ | Validación continua de integridad presupuesto↔control |
| 2026-06-13 | **Retrofit de GDR** al estándar mejorado de CH (fórmulas dinámicas, checks, exclusión EQ, fix avance, CONFIG auditable) | GDR debe seguir siendo la referencia maestra; las mejoras nacidas en CH se portan a GDR |
| 2026-06-14 | **Costos de `1_Presupuesto` estandarizados a POR-UNIDAD en todas las obras** (GDR convertido de total → unidad; CH ya lo era). K/L/M/N son por-unidad; el total es derivado (`Costo_total`/Subtotal = ud×cant) → formula-pure | Estándar único cross-obra: K/L/M/N significan lo mismo en GDR y CH, los procesos no ramifican. Conversión *value-preserving* (Conversión profunda A): cada total/agregado se preservó insertando ×Cant en el punto de consumo (Z=V×J, X=R×J, AL/AM/AN ×J, O228 y CONFIG B18-B20 y Control D/Q vía SUMPRODUCT×J, Dashboard C18 pondera por U×J). Verificado: Δ máx 1,19e-7 en todo el contrato del dashboard. Backup: `_bak_GDR_pre_conversionA.xlsx` |
| 2026-06-19 | **Plan de Cuentas Tezamat = fuente de verdad de rubros** (rama 53 OBRA con split MT/MO; cruce por código, no por texto). Aplicado en CH v8_7: `_Listas` reescrito, dropdowns `RUBROS_PLAN`, sanity checks rubro∈plan | Elimina la divergencia de nomenclatura Tezamat↔Excel que dejaba ~$8,5M de gasto como "sin presupuesto". Value-preserving (total ppto intacto). Ver memoria `plan-cuentas-tezamat-rubros` |
| 2026-06-19 | **Reorganización del proyecto al alcance nuevo** (Excel-DB + `dashboard_v2/` + app cert): material superado → `_archivo/` (gitignored); dashboard v1 jubilado (rescatados a v2: `LOGICA_CALCULO_v8.md`, ESPEC cert, `design/`, CLAUDE.md); `CLAUDE.md` raíz reescrito | El nombre "migración" ya no describe el proyecto; el árbol vivo debe reflejar solo lo vigente. Nada se borró salvo basura regenerable. Ver `_archivo/README.md` y `docs/HANDOFF_flujo_resumen_v8.md` §7 |
| 2026-06-19 | **Addendum circuito Cert_* → v8_8** (HANDOFF §5/§10, solo forma): desacopio a **nivel madre** (hoja nueva `Cert_Cabecera`, `Cert_Calculo!J` input→ref); **CAC con override** (`Cert_Calculo!Y` + `N=IF(override,…)` sobre el índice); `id_factura` estructurado (`…-B-F{NN}`); `Cert_Facturacion` forma final (`monto`/`moneda`/`monto_ars_equiv`+`id_OC`/`id_cert_madre`/`Clase`); `Cert_Control_OC!G/H`→`monto_ars_equiv` | Value-preserving (recalc 0, `monto_ars_equiv`=D_old exacto). **NO** incluye la conciliación contra `2_Movimientos` (spec siguiente, §10 pto 6). El dashboard reader debe actualizarse antes de leer v8_8. Script: `scripts/addendum_cert_ingresos.py` |
| 2026-06-19 | **Anticipo separado del "certificado de avance"** (dashboard): el certificado total incluía el anticipo (>50%, inflaba el headline). El reader expone `certificado_avance` (= total − anticipo) y `anticipo` por OC; el dashboard muestra "Certificado de avance" sin anticipo, con el anticipo como línea propia visible en el estado de la OC (sigue siendo plata facturada/cobrada, se recupera vía desacopio). Solo reader+frontend (`cert.py`, `read_obra.py`, `ds.js`); Excel intacto (ya separaba el anticipo en `Cert_Control_OC!I`) | El "certificado al fideicomiso" deja de confundirse con el avance físico. `total_certificado` se conserva para reconciliación |
| 2026-06-19 | **`2_Gastos_DirInd` reestructurada → v8_11**: de matriz (concepto × mes) a **tabla plana** tipo `2_Movimientos` (cols `Fecha \| Tipo \| Concepto \| Monto`), para carga append-friendly. Dropdowns: Tipo (Directo/Indirecto) y Concepto (named range `GASTOS_CONCEPTO` en `_Listas`). 13 registros migrados value-preserving | Hoja = solo almacén (el diseño/agrupado/deflactación CAC va en el dashboard). Nadie la referenciaba (0 fórmulas). DV sobrevive el round-trip COM. Script: `scripts/reestructurar_gastos_dirind.py` |
| 2026-06-19 | **Control Presupuesto por bloques** (dashboard, **4 bloques**): **Costo de Obra** (rubros 53 + Mov. Variables, controlable, ppto `1_Presupuesto`, **ordenado por etapa**) · **Gastos Generales** · **Gastos Directos** · **Gastos Indirectos** — los 3 GGBB presupuestados por `1_GGBB` **columna G** por sección (los ítems con costo en J/K ya están en el ppto de obra y no entran). Gasto de cuentas indirectas asignado a sección por keyword (best-effort). Ingresos (4x) fuera | Buena práctica: cada bloque con lógica distinta (obra=control estricto; GGBB=monitoreo por sección). Resuelve los "rubros sin presupuesto". Solo reader+frontend, Excel intacto. **Aguas** mal clasificada (es Gastos de oficina) → reclasificar en Tezamat. Ver `pendientes.md` (mapeo gasto→sección a confirmar) |
| 2026-06-19 | **Dashboard repuntado a v8_10** (track 2): reader `dashboard_v2/` actualizado al layout final — `movimientos.py` parsea la convención `{ID} \| {TIPO}` (BASE/CAC/ANT/CS); `read_obra.py` matriz subcontratos (BASE+ANT descuentan, CAC/CS no); `cert.py` lee `monto_ars_equiv`/`Retención`/`Estado conciliado` | Validado end-to-end (Flask 200 en API + drills + vistas; KPIs reconcilian: PTO 01 22,13%). `config/obras.yaml` → v8_10 |
| 2026-06-19 | **Avance real OC01 → v8_10**: cargado el avance físico real de las certs #1/#2 (documento `CH 2171_Presupuesto 01_Cert. #2.xlsx`) en `Cert_App_Output`; vaciado lo inventado (OC01 C03/C04, todo OC02, todos los cobros) | Primera carga de datos reales. Reconcilia con el documento (avance OC01 **22,13% exacto**, base certif Δ<$100). Fiscal/cobros/OC02 = pendientes (ver `pendientes.md`, incl. observaciones Tezamat para ingresos). Script: `scripts/cargar_cert_reales_oc01.py` |
| 2026-06-19 | **Conciliación 2_Movimientos → v8_9** (`SPEC_Conciliacion_Movimientos_v8.md`): convención `{ID} \| {TIPO} \| {desc}` en `2_Movimientos!E` (TIPO=BASE/CAC/ANT/CS); parseo `mov_id`/`mov_tipo` (cols Q/R); egresos en `2_Subcontratos` (H-N: pagado BASE+ANT/CAC/CS, saldo, estado); ingresos en `Cert_Facturacion` (+`Retención`/`Haber conciliado`, `H`→Estado conciliado **computado**); tolerancia `0_CONFIG!B49` | Regla CAC/CS **no descuenta saldo** (verificado: CAC SC-003 excluido). Estado **computado, no flag manual**. Ingresos inertes hasta que Tezamat tague cobros por-cert. Surfaceó SC-002 sobrepagado. Reader del dashboard se actualiza UNA vez al layout final (v8_8+v8_9). Script: `scripts/spec_conciliacion_movimientos.py` |
| 2026-06-22 | **Migración GDR a v8 — Bloque 2 (`1_Presupuesto` + `_Listas`) → `GDR_..._v8_12.xlsx`** (Q8): rubros de GDR alineados al plan Tezamat con **rename consciente de columna** (GDR nombraba sin split MT/MO; col A/B→"X MT", C/D→"X MO"; single-rubros igual). `_Listas`=rama 53 OBRA+`Mov.Variables`(52302)+`Supervisión de Obra MO`(52209); `RUBROS_PLAN`+dropdowns A:D y `2_Quincenas!E`+sanity. Descarte de `_Listas` vieja confirmado | Value-preserving (solo texto, recalc 0, 0 rubros fuera de plan). Mapeos clave: Electricidad→Eléctrico, Durlock/Yeso→Durlock, Agrimensura+Preliminar→Preliminares, Excavación→Movimiento de Suelos, GG Obra→Gastos Generales, Movilidad→Mov.Variables. Scripts: `reconciliar_plan_cuentas_gdr.py` + `aplicar_plan_cuentas_gdr.py` |
| 2026-06-22 | **Supervisión de Obra = rubro de obra visible (CH y GDR igual)** (Pedro): indirecto por naturaleza (52209/H.Ingeniería) pero suma al ppto de obra y se factura al cliente → se mide como un rubro más, **no** se mueve a indirectos (revisa el pendiente viejo de CH). Pendiente de definición final con Arquinering | En ambas obras figura como etapa del presupuesto → mismo tratamiento. Implica excepción en el reader (bloque 10/Q7) para mostrarlo en el bloque Obra pese al código 52xx |
| 2026-06-22 | **Migración GDR a v8 COMPLETA → `GDR_..._v8_12.xlsx`** (bloques 1-10, Q1-Q8 confirmadas con Pedro): plan de cuentas Tezamat (rename por columna A/B→MT, C/D→MO) · `0_CONFIG` (mes base CAC dic-2024, B70/N30/GGN, SUMPRODUCT auditables) · `1_Composicion`/`1_GGBB` no-op (ya conformes) · `2_Gastos_DirInd` plana · `2_Movimientos` placeholder · `2_Subcontratos` matriz CH (GDR-SC-NNN) · circuito **`Cert_*` con 3 OC reales** (OC01 $500,9M/100%, OC02 $844,8M/49,4%, OC03 Adic $96,3M) + avance historial completo (471 filas) + dimensión Presupuesto en `1_Presupuesto` (etapa≤3→PTO01, ≥4→PTO02) · legacy eliminada (17 hojas). `0_Indice_CAC`/`0_Jornales_MO`/`2_Quincenas`/`2_Subcontratos` quedan **locales** (Q1/Q5/Q6) hasta maestros cross-obra | recalc 0 + COM OK + cache poblado. Reader del dashboard **absorbe GDR sin cambios de código** (Q7): único fix Excel = fila TOTAL en `Cert_Control_OC`. **Portfolio multi-obra real** (CH+GDR, Flask 200). Incremento avance %=Δacum% (telescopa); $ base sin CAC = %×PV budget (OC03 adic: PV del doc). Pipeline reproducible (8 scripts `*_gdr.py`). ⚠ Lección: number formats vía **script file**, no `bash -c` (escaping rompe → corrupción zip) |
| 2026-06-24 | **`1_Presupuesto` estandarizado a un layout ÚNICO en las 3 obras** (CH v8_12 · GDR v8_13 · SVD v8_2): 25 cols A:Y idénticas, sin diferencias de fórmula. **Venta = input por tarea** (`P.Unit`, fuente de verdad estable) en todas (CH/GDR value-preserving) + columna **`Margen` = PV÷Costo Unit derivada** (margen verificable por tarea: CH/GDR uniforme, SVD 7 coefs distintos; coef de armado queda en `1_GGBB`). **Avance reducido a 1 columna** `% Acum Tot` (`=SUMIFS Cert_App_Output`); se eliminó todo el bloque redundante (manual legacy, `% Cert Actual`, `Imp.*`, desglose `Acum`, `Control`, `Acum_tot $`). PV subtotal = 1 columna. Recableo de consumidores por **remapeo de columnas preservando filas**: `0_CONFIG` (incl. ArrayFormula en CH), `Cert_App_Output.I`, `Cert_Control_OC.E`, `1_Composicion` (CH), `_Listas`. Reader+drilldown: avance per-rubro y `$ certificado` = `% Acum Tot × PV subtotal` | Confirmado con Pedro (4 preguntas; eligió unificar venta a input). Value-preserving EXACTO vs viejo recalculado (CONFIG costo/venta, % avance físico y certificado por OC sin cambios; recalc 0; Flask 200 + drilldowns OK). ⚠ Lección: `Cert_App_Output.I` (PV total tarea) deriva de `1_Presupuesto` vía SUMIFS de **columna completa** (scan inicial las perdió por exigir dígito); CH `0_CONFIG` usa **ArrayFormula** (no es `str`). SVD `Cert_App_Output.I`=valor del doc. Script: `scripts/estandarizar_presupuesto_v8.py` |
| 2026-06-24 | **Bloques GGBB del Control con formato de control completo** (dashboard; supera la decisión 2026-06-19 sobre presupuesto/gasto de GGBB): Gastos Generales/Directos/Indirectos pasan a la misma tabla que Costo de Obra (Presupuestado·Gastado·Saldo·Consumo·Desvío, sin avance s/cert). Gasto = **doble fuente** (`2_Gastos_DirInd` + cuentas indirectas Tezamat) mapeada a su **línea de `1_GGBB`** por nombre normalizado (renombres en `GASTO_A_LINEA`; hoy solo Payroll Administración→Admin); sin match → fila "sin ppto". Bloque por **sección de `1_GGBB`** (no por col Tipo). Rubros de obra **ordenados por etapa agrupando MT/MO** (MO antes que MT). Solo reader+frontend; Excel intacto | Confirmado con Pedro (3 preguntas). Contrato: `bloques[ggbb]` de `{items,gasto_cuentas}`→`{rubros}` (aditivo: top-level `rubros` y subtotales intactos). Flask 200 CH/GDR/SVD + screenshot OK. Pendientes de datos en `pendientes.md` (typo "Homigón", Edenor/Aysa, Payroll Socios sin línea). `read_obra.py`+`ds.js` |
| 2026-06-22 | **Migración SVD 4140 legacy→v8 COMPLETA → `SVD_4140_..._v8_1.xlsx`** (3ª obra; primera construida **desde legacy clásico**, no retrofit): clon de GDR v8_12 + repoblado bloque por bloque. `1_Presupuesto` 191 tareas (PTO01 44 + PTO02 147) desde `Pto.Costos`/`Pto.Vta`; `1_GGBB`=template legacy (markup F66); `2_Movimientos`=319 mov Tezamat reales (cc SALVA4140); `2_Subcontratos`=10 (SVD-SC-NNN); circuito `Cert_*`=3 OC + 404 filas de avance real (20 certs: Pto01 12 + Pto02 8). recalc 0 + COM + Flask 200 → **portfolio 3 obras, reader sin cambios** | **Decisión clave: venta = INPUT por tarea** (markup NO uniforme en SVD: PTO01 1,333 / PTO02 1,268 y varía por tarea → un coef único rompía los montos de OC). value-preserving EXACTO (venta total $1.158.163.185 = subtotales Pto.Vta). PV del doc almacenado en `Cert_App_Output` (evita problema de códigos partidos 2.01.01/02). IVA 10,5% (obra civil); split fiscal por OC derivado de `Facturacion` (OC01 B37,5/N62,5 · OC02 B24,1/N75,9). Mapeos rubro best-effort + split MO OTR/ALB por cuadrilla propia (marcados en `pendientes.md`). Pendientes de datos: cobros, quincenas (M.O.), OC03 avance, tagueo SC. Pipeline: `scripts/svd_bloque{2,4,356,6b,7,8}_*.py` |

---

## 12. CONTACTO Y VALIDACIÓN CON EL CLIENTE

Cualquier ambigüedad en mapeo de rubros, clasificación MO (ALB vs OTR), o interpretación
de fórmulas del legacy debe registrarse en `logs/pendientes.md` y NO resolverse
asumiendo. Esperar confirmación explícita de Pedro antes de proceder.

Frases que indican que hay que hacer checkpoint:
- "No sé si esto es ALB o OTR"
- "El legacy tiene un rubro que no está en la lista canónica"
- "La fórmula del legacy referencia una celda que no entiendo"
- "El valor calculado difiere >1% del original sin explicación clara"

## Autonomía de ejecución

### Actuar SIN pedir permiso para:
- Leer, abrir o escanear cualquier archivo del proyecto (.xlsx, .py, .md, .csv)
- Correr recalc.py sobre cualquier archivo en archivos/output/ o archivos/referencia/
- Inspeccionar hojas, celdas, fórmulas y estilos dentro de los Excel
- Aplicar correcciones de fórmulas (#REF!, #NAME?, #VALUE!) que no cambian lógica de negocio
- Crear o modificar archivos en scripts/ y logs/
- Registrar ambigüedades en logs/pendientes.md
- Verificar resultados después de aplicar un fix

### Consultar SIEMPRE antes de:
- Cambiar la estructura de hojas (agregar, eliminar, renombrar)
- Modificar reglas de cálculo del Resumen de Obra (lógica de rubros, MO, APU)
- Decidir cómo mapear un rubro legacy que no tiene equivalente claro en v8
- Sobreescribir o eliminar archivos en archivos/fuente/ o archivos/referencia/
- Cualquier cambio que afecte el output final que va al cliente

### Principio general:
Si la tarea fue explícitamente solicitada y la acción es necesaria para completarla,
ejecutala. Solo interrumpí para decisiones que cambian el alcance o la lógica de negocio.