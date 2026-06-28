# HANDOFF — Flujo completo del Resumen de Obra v8

> Documento de contexto/arquitectura para Claude Code. Describe el **qué** y el **porqué** del flujo de punta a punta. No es un documento de ejecución: los bloques, checkpoints y specs de implementación viven en sus archivos propios (p. ej. `ESPEC_Circuito_Certificacion_v8.md`).
> **Estado:** consolidado en sesión de repaso, junio 2026.

---

## 0. Cambio de paradigma

El Resumen de Obra deja de ser un Excel "360" (que recopilaba toda la info de la obra **y** tenía hojas para analizar resultados) y pasa a ser una **base de datos**. El análisis y la visualización se mueven a un **dashboard web** (HTML) que se alimenta del Excel.

- **Excel v8 = base de datos** (fuente de verdad, formula-pure, auditable con `recalc.py`).
- **Dashboard web = capa de análisis/visualización** (lee del Excel, no calcula la verdad del dato).

Este reparto es la decisión rectora de todo lo que sigue.

---

## 1. Clasificación de fuentes de datos

### 1.1 Datos cross-obra (fuente única en la web → todos los resúmenes la consumen)

Se actualizan en **un solo lugar** y impactan en todos los resúmenes. Evita actualizar N archivos.

- Índices CAC (INDEC).
- Tarifas teóricas de jornales por categoría (UOCRA).
- Tipo de cambio del dólar.

### 1.2 Datos por obra pero con estructura común (archivo maestro compartido)

Estructura idéntica entre obras; el dato se carga una vez. Se sube como fuente y cada resumen consulta lo suyo.

- **Maestro de Subcontratos** (lo mantiene Compras al cerrar presupuesto con un contratista). Campos: obra, ID, ID+Obra (clave única), proveedor, rubro (plan de cuentas Tezamat), descripción del trabajo, monto presupuestado aprobado, % de anticipo (si corresponde). Cada resumen consulta qué subcontratos tiene su obra y arma la vista de seguimiento, cruzando con los pagos de su propia base.
- **Resumen de quincenas** (horas trabajadas). Al cerrar la quincena, una **skill** produce una tabla de horas por obra/rubro/categoría. Se sube el resumen completo y cada obra toma su parte. Alimenta la vista **Control de Jornales** (horas presupuestadas vs. trabajadas por rubro/categoría).
- **Gastos Directos e Indirectos** (candidato futuro al mismo tratamiento). Hoy se actualizan a mano desde un Excel maestro; evaluar subir el maestro y que cada obra tome lo suyo, igual que quincenas.

### 1.3 Datos únicos por obra (se vuelcan en el resumen correspondiente)

- **Presupuesto aprobado.** Copia de la hoja resumen del presupuesto: cada tarea con cantidad a ejecutar, costo abierto por **materiales / provisiones / mano de obra subcontratada / mano de obra interna**, precio de venta (vía coeficiente de GGBB) y **rubro del plan de cuentas Tezamat por tarea**. (Ver §2, regla de las 4 columnas.)
- **Composición.** Sale del APU Unificado; detalle de composición de cada partida. Permite calcular **horas presupuestadas por tarea y categoría** (insumo del Control de Jornales). A futuro: comparar compra de materiales vs. presupuestado (hoy no se puede porque en Tezamat se carga el total de la factura con descripción genérica, sin detalle de ítems).
- **GGBB.** Gastos generales de obra: presupuesto de algunos directos/indirectos y coeficiente de precio de venta.
- **Movimientos** (ver §3).

---

## 2. Regla de los 4 rubros del presupuesto (crítica)

Arquinering **no usa código WBS** en los requerimientos de compra. En Tezamat, cada factura se carga como un único ítem por el total y se clasifica en una cuenta de resultado por rubro de obra.

Problema: para una misma tarea, **el rubro imputado en una compra de materiales no siempre coincide con el rubro imputado en el pago de quincenas** de esa misma tarea. Porque el Jefe de Obra **no puede informar en qué tarea trabajó cada obrero**: simplifica e informa por rubro según la etapa de obra.

Ejemplo: tarea "visita de topógrafo" con presupuesto de materiales y de MO interna. La compra de materiales se imputa a "Agrimensura MT". Pero las horas de los obreros de esa quincena el Jefe de Obra las agrupa como **"Preliminares"** (no sabe el detalle por tarea).

Por eso, al cerrar el presupuesto se agregan **4 columnas que asignan un rubro a cada tarea, una por tipo de costo**: materiales, provisiones, MO subcontratada, MO interna. Si no se separa así, se infla el presupuesto de un rubro que nunca recibirá el gasto (queda sobre-presupuestado) y otro queda sub-presupuestado.

> Relacionado (de decisiones previas): la MO interna (MO/ALB) mapea siempre a **"Preliminares"** para control, porque los foremen no pueden reportar detalle de labor por tarea.

### 2.1 Estructura estándar de `1_Presupuesto` (v8, unificada 2026-06-24)

Las 3 obras (CH, GDR, SVD) comparten **un único layout** de `1_Presupuesto` (header en fila 3,
datos desde fila 4), **sin diferencias de fórmula entre obras**:

| Bloque | Columnas | Tipo |
|--------|----------|------|
| Rubros (regla §2) | `Rubro MT` · `Rubro MT/Prov` · `Rubro MO/OTR` · `Rubro MO/ALB` | input |
| Identificación | `Cod. Ítem` · `Estado` · `Descripción` · `U` · `Cant` | input |
| **Costo unitario** | `MT` · `MO/OTR` · `MO/ALB` · `EQ` · `Costo Unit.` (=SUM) | inputs + 1 fórmula |
| **Precio venta unitario** | `MT` · `MO/OTR` · `MO/ALB` · `EQ` (=proporcional al costo) · `P.Unit` (input) · `Margen` (=PV÷Costo Unit) | input venta + fórmulas |
| Subtotales (×Cant) | `Costo total` (=Costo Unit×Cant) · `PV subtotal` (=P.Unit×Cant) | fórmula |
| Dimensión | `Etapa` · `Presupuesto` (PTO 01/02/…) | input |
| Avance | `% Acum Tot` (única; `=SUMIFS(Cert_App_Output)` por Cod+Presupuesto) | fórmula |

**Decisiones de diseño (confirmadas con Pedro):**
- **Venta = input por tarea** (`P.Unit`) en TODAS las obras — es la **fuente de verdad** (precio
  aprobado, estable; no se re-precia si se editan costos, lo que protege la base de certificación
  que lee el PV subtotal). Soporta markup no uniforme (tareas cotizadas más caras). El desglose de
  venta por tipo se reparte proporcional al costo.
- **`Margen` = `PV ÷ Costo Unit.` (columna derivada)** — hace el **margen verificable tarea por
  tarea** sin atar la venta al costo. CH/GDR dan un coef uniforme (1,3565 / 1,3327); SVD varía por
  tarea (1,2569 / 1,3952 / 2,0571…). Tareas venta-sin-costo (ej. SVD `19.17`) → margen n/d, venta
  conservada. El coeficiente global de armado sigue viviendo en `1_GGBB` como referencia.
- **Avance físico reducido a 1 columna** (`% Acum Tot`). Se eliminó todo el bloque redundante
  (manual legacy `% Acum Ant`/`% Cert Actual`, los `Imp. *`, el desglose `Acum MT/MO/EQ`,
  `Acum_tot $`, `Control`). El avance es derivado de **`Cert_App_Output`** (fuente de verdad) y
  el dashboard recalcula desde ahí. Se conserva `% Acum Tot` porque es lo mínimo que permite a
  `Cert_Control_OC!E` (% avance físico por OC) reproducir el valor **exacto** ponderado por el PV
  del presupuesto — necesario porque SVD almacena en su circuito un PV propio (del documento) que
  difiere del PV del presupuesto.
- **PV subtotal** = una sola columna (el desglose por tipo ya está en las 5 columnas de venta unitaria).

**Acoplamiento (consumidores de `1_Presupuesto`, recableados al estandarizar):** `0_CONFIG`
(SUMPRODUCT costo/venta, incl. **ArrayFormula** en CH), `Cert_App_Output.I` (PV total tarea =
SUMIFS de PV subtotal por Cod+Presupuesto, en GDR/CH; SVD usa valor del documento), `Cert_Control_OC.E`
(% avance físico), `1_Composicion` (XLOOKUP Cod→Rubro, solo CH), `_Listas` (sanity rubro∈plan, A:D).
La reconstrucción **preserva el número de fila** de cada tarea, por lo que el recableo es sólo
remapeo de letras de columna. Script: `scripts/estandarizar_presupuesto_v8.py` (value-preserving
exacto verificado: CONFIG, certificado y % avance físico por OC sin cambios).

---

## 3. Egresos — Tezamat como fuente única

**Decisión cerrada:** Tezamat es la **única fuente de todos los egresos monetarios**, incluida la nómina (quincenas se cargan en Tezamat con centro de costo y categoría). No reintroducir la doble fuente.

> Separación importante: de Tezamat sale el **monto monetario** de jornales. Del **informe de quincenas** (skill) salen las **horas trabajadas**. Son datos distintos para vistas distintas; no se pisan.

### 3.1 Flujo de egresos (ver diagrama swimlane)

Dos ramas que convergen:

- **Con factura:** Compras recibe factura → imputa rubro (plan de cuentas) → carga en Tezamat (cuenta = rubro; ID/tipo en observaciones) → Karina liquida y paga (banco) → Control de Gestión carga el pago manteniendo observaciones detalladas.
- **Sin factura:** Compras recibe remito/certif. → imputa rubro → carga en Tezamat.
- **Quincenas:** Jefe de Obra informa horas por obrero y rubro (código SC si corresponde) → RRHH corre la skill de resumen de quincenas (obra/rubro/cat./SC) → Control de Gestión carga las quincenas en Tezamat (cuenta = rubro; ID/tipo en observaciones). Genera **(1)** gasto por obra y rubro + pago SC, y **(2)** horas trabajadas por obra/rubro/categoría (esto último va directo al resumen, no por Tezamat).
- Compras mantiene el **archivo maestro de Subcontratos**, que provee el ID a los bloques marcados SC.
- Cierre: se **exporta el Libro Mayor** de Tezamat filtrado por obra (centro de costo) y se vuelca al Excel Resumen de Obra.

### 3.2 Hoja de destino en el Excel

La hoja se llama **`2_Movimientos`** (renombrada desde `2_Gastos`), porque ahora unifica **ingresos y egresos**, no solo gastos. Junto con `2_Subcontratos` y `Control Ppto` consume el extracto.

### 3.3 Datos clave de Movimientos (extracto de Tezamat por centro de costo)

- **Descripción de la cuenta** — contiene el rubro.
- **Fecha** — para cash-flow y para truncar y **deflactar por CAC** (mes del movimiento).
- **Observaciones** — descripción del movimiento. **Reglas de carga (críticas):**
  - Pago a contratista → incluir **ID de subcontrato** y **nº de certificación**.
  - **Separar monto base y monto CAC en registros distintos.** El CAC suma como gasto pero **no descuenta saldo disponible del presupuesto del subcontrato**. El registro de CAC lleva ID de subcontrato + certificación + la marca `CAC`.
  - Anticipo → marcar `anticipo` en observaciones.
  - Proporción de certificación pagada vía quincenas (obreros del contratista dados de alta en nómina de Arquinering) → detallar ID de subcontrato; **separar cargas sociales** en registro propio con ID de subcontrato + `cargas sociales` (no impacta contra presupuesto aprobado).
  - Ingresos (al certificar/facturar al cliente) → **separar monto base y CAC**; el CAC no descuenta saldo disponible a certificar de la OC-Cliente.
- **Cliente/Proveedor** — útil para análisis de compras.
- **Debe / Haber** — Debe = egresos; Haber = ingresos.
- **Centro de costo** — la obra.

---

## 4. Vista de Control de Presupuesto por rubro

Compara, por rubro, **presupuestado vs. gastado**.

- **Lado presupuesto:** rubro asignado por tarea según las 4 columnas (§2).
- **Lado gasto:** rubro asignado al imputar la factura (plan de cuentas).
- **Deep-dive presupuesto:** agrupa todos los costos asignados a ese rubro por tarea; en la hoja Composición se ve cada ítem de la tarea y tipo de costo.
- **Deep-dive gasto:** filtra ese rubro en el extracto de Tezamat y lista cada movimiento.

> EQ excluido del total de costo controlable (de decisiones previas): el destino apuntaba a `3_Control_Ppto!E34`, no a `1_Presupuesto!O228`. ⚠ Verificar contra v8_7: si `3_Control_Ppto` se eliminó al pasar a Excel=DB, este apuntamiento migró a donde hoy viva el control de presupuesto (a confirmar en inventario).

---

## 5. Ingresos — circuito de certificación, facturación y cobro

### 5.1 Reparto web / Excel (decisión de arquitectura)

El input manual se hace en la **web**; cada confirmación **congela un registro inmutable que se almacena en el Excel** para auditar. La web es interfaz de carga; el Excel es la base auditable. El dashboard lee del Excel.

Esto preserva el principio rector (§0): la verdad del dato vive en el Excel, donde se concilia contra Tezamat y donde está la trazabilidad (`recalc.py`).

> Insumo de la web: el **presupuesto y las OC-Cliente** ya subidos (detalle de tareas + precio de venta) alimentan la app del Jefe de Obra y el resto del circuito.

### 5.2 OC-Cliente

Tras aprobarse el presupuesto, se crea la **Orden de Compra al cliente**. Una obra puede tener **más de un presupuesto/OC** (práctica común: separar p. ej. Preliminares+Hormigón en una OC y el resto en otra; además pueden surgir adicionales).

Datos particulares por OC: monto de presupuesto aprobado, % de anticipo, mes base CAC, % IVA.

**Ciclo de vida de la OC:** cada OC queda **abierta** y se va certificando contra ella a medida que avanza la obra, hasta alcanzar el **100%**, momento en que se **cierra**. El estado se refleja en el semáforo computado de `Cert_Control_OC` (incluye "Cerrada"). La captura de avance del Jefe de Obra se hace **solo contra OC abiertas** (las cerradas no se ofrecen como opción de certificación — regla de la app, §5.3 paso 1).

> **Nota de nomenclatura.** El archivo en producción (v8_7) usa **Blanco / Negro** para la partición fiscal. Equivale a: **Blanco = con factura = `-B` = lleva IVA**; **Negro = sin factura = `-N` = se paga en USD al MEP, sin IVA**. Se conserva Blanco/Negro como nomenclatura real; "con/sin factura" es la glosa explicativa. No renombrar lo que ya está en celdas.

1. **Jefe de Obra confirma avance** (app/web). Selecciona **obra > OC** (solo entre las **OC abiertas**; una obra puede tener varias OC simultáneas, una por presupuesto) y carga **% de avance físico por tarea** de ese presupuesto. Captura pura — sin cálculo. Genera registro por tarea en `Cert_App_Output`: obra, ID OC, ID Certif, fecha, código de tarea, % avance anterior, % avance actual, % avance total.
2. **Dirección de Obra valida + desacopio.** Revisa el % por tarea, valida y agrega el **% de desacopio de la certificación**. **El desacopio es uno solo por certificación** (decisión cerrada): lo fija DO **a nivel de la certificación madre**, sobre el subtotal, **antes** de la partición fiscal. No se carga por rama Blanco/Negro. Genera cabecera de certificación: ID Certif, fecha, monto total OC, % y $ anticipo (heredado), monto base certificado actual (fórmula), % y $ desacopio, **subtotal certificación neto** (= certif. actual − desacopio). Genera **PDF/vista estandarizada** para el cliente.
   > ⚠ **Cambio respecto del archivo v8_7:** hoy el archivo aplica el % desacopio por rama (input en cada fila Blanco y Negro de `Cert_Calculo`, col J). Hay que migrarlo a una sola carga a nivel madre. (Ver addendum de ajustes.)
3. **Cliente confirma → partición fiscal.** Sobre el subtotal neto se aplican, como inputs:
   - **% Blanco / % Negro** (validado a 100%).
   - **Índice de actualización CAC** — fórmula por defecto (ratio = índice_fecha / índice_base), con **override manual** habilitado para casos donde INDEC publique tarde o haya ajuste pactado distinto.
   - **% de IVA** — sobre la parte **Blanco** (la Negro no lleva IVA).
   - **USD MEP** — para la parte **Negro** (se paga en dólares), input editable.

   Genera **dos certificados hijos** sobre la misma certificación madre, cada uno con su ID (`-B` / `-N`).
4. **Facturación y cobro.** Karina hace **una o más facturas** contra el certificado **Blanco** (puede haber >1 factura por certificación). Luego registra los **pagos recibidos**: banco (ARS) para la parte Blanco, dólares para la parte Negro.

> **Corrección fiscal anotada:** Blanco/con factura → IVA; Negro/sin factura → USD MEP, sin IVA.

> **Estado de la certificación: semáforo computado, no máquina de estados persistida** (gana el diseño del archivo). El estado se **deriva por fórmula** de los deltas de plata (Sin iniciar → En ejecución → Por facturar → Por cobrar → Cerrada, + Certificar), como en `Cert_Control_OC!M`. No hay campo de estado mutable que alguien actualice a mano — evita desincronización.

### 5.4 Esquema de IDs (emitidos SOLO por la web, nunca a mano)

Generación automática para evitar errores de tipeo en la clave de la que dependen todos los SUMIFS/XLOOKUP aguas abajo. **Formato real del archivo v8_7** (el handoff se alinea a este, no al revés):

- **OC:** `{OBRA}-OC{NN}` (ej. `CH-OC01`).
- **Certificación madre:** `{OBRA}-{OC}-C{NN}` — token `C`, 2 dígitos, **sin** `CERT` (ej. `CH-OC01-C01`).
- **Anticipo:** `{OBRA}-{OC}-ANT`, tratado como una certificación madre más (ej. `CH-OC01-ANT`).
- **Sufijo de partición fiscal:** `-B` (Blanco) / `-N` (Negro), sobre el ID Cert+Fact (ej. `CH-OC01-C01-B`, también `…-ANT-B/-N`).
- **Comprobantes/facturas:** hoy string humano libre en col Comprobante (`FA-B 0001`, `REC-N 0001`, `REC-ANT 0001-B/-N`). No hay aún un ID de factura estructurado colgando del `-B`. (Candidato a estructurar — ver spec de conciliación.)

**Puente a Tezamat (funcionalidad NUEVA — hoy no existe en el archivo):** la web genera el ID, pero **Karina lo tipea a mano** al cargar el cobro/pago en Tezamat (observaciones). Para evitar desajustes, la vista de certificación debe **mostrar el/los string(s) exacto(s) a copiar** en observaciones. Como un cobro Blanco genera **dos registros en Tezamat** (base y CAC), la vista debe exponer **ambos strings ya armados** por registro:
- Monto base → `{OBRA}-{OC}-C{NN}-B`
- Monto CAC → mismo ID + `CAC`

(Los sufijos `B`/`N` no chocan con otras convenciones de observaciones ya en uso.)

### 5.5 Modelo de datos — hojas Cert_* reales (v8_7)

El archivo implementa el circuito en **5 hojas `Cert_*`** (no las 5 tablas conceptuales que listaba la versión anterior de este handoff). Mapa real:

- **`Cert_OC_Cliente`** — condiciones por OC: presupuesto aprobado, % anticipo, mes/índice base CAC, % Blanco/Negro sugerido, % desacopio sugerido, % IVA sugerido, y la llave `Presupuesto` (PTO 01/02) que ata la OC a la dimensión de `1_Presupuesto`. Cubre **multi-OC / multi-presupuesto** (ya soportado).
- **`Cert_App_Output`** — staging del avance físico por tarea (la app del JO emite estos registros). Cruce avance→PV por **clave compuesta presupuesto+código**.
- **`Cert_Calculo`** — cascada de cálculo, 2 filas por certificación (Blanco + Negro): base, desacopio, CAC (ratio), IVA, total ARS, USD MEP. *(Aquí impactan los ajustes: desacopio a madre, CAC override.)*
- **`Cert_Facturacion`** — comprobantes y cobros. *(Aquí impacta la conciliación contra `2_Movimientos` y el `monto_ars_equiv`.)*
- **`Cert_Control_OC`** — rollup por OC con estado computado (semáforo).

**Multi-OC:** ya resuelto en el archivo vía `Cert_OC_Cliente!L` (Presupuesto) + dimensión `AQ` de `1_Presupuesto`. No requiere una tabla `Tareas_OC` separada; las tareas de cada OC se filtran por el presupuesto (PTO 01/02). El handoff ya no pide `Tareas_OC` como tabla aparte.

**`Cert_Facturacion` — objetivo de rediseño (tabla única de cobros).** Hoy el archivo usa columnas separadas `$ Monto`(D) y `USD Monto`(E) y clasifica por Blanco/Negro/Anticipo. Falta capturar el **TC del momento del cobro** para medir diferencia de cambio. Estructura objetivo (a definir en el spec de conciliación):
- `tipo` (Blanco / Negro / Anticipo)
- `id_cert_fact` (`-B` / `-N`)
- `id_factura` (estructurado, solo Blanco)
- `moneda` (ARS / USD)
- `monto` (en moneda del cobro)
- `monto_ars_equiv` (para Negro: USD × **TC del momento del cobro**, no el MEP de la certificación)
- `fecha_cobro`, `id_OC`, `id_cert_madre`

Razón: "cobrado vs. pendiente por certificación madre" debe ser un solo SUMIFS; hoy `id_OC`/`id_cert_madre` están embebidos en el string y no como columnas propias.

---

## 6. Hojas Cert_* y enganche con 1_Presupuesto (estado real v8_7)

Las 5 hojas reales: `Cert_OC_Cliente`, `Cert_App_Output`, `Cert_Calculo`, `Cert_Facturacion`, `Cert_Control_OC`. (Detalle de roles por columna en el inventario de v8_7; resumen en §5.5.)

Enganche con `1_Presupuesto` (ver §2.1 para el layout estándar vigente, 2026-06-24):
- **`% Acum Tot`** = SUMIFS desde `Cert_App_Output` por **clave compuesta código+presupuesto** (soporta multi-OC). Es la **única** columna de avance que queda en `1_Presupuesto`.
- **`Cert_App_Output.I` (PV total tarea)** = SUMIFS del `PV subtotal` de `1_Presupuesto` por Cod+Presupuesto (en GDR/CH). En SVD `I` es valor del documento (difiere del PV del presupuesto por códigos partidos).
- **`Presupuesto`** = dimensión PTO 01 / PTO 02, la llave multi-OC.
- **`Cert_Control_OC.E` (% avance físico)** = `Σ(% Acum Tot × PV subtotal) / Σ PV subtotal` por presupuesto.
- Precio de venta (estándar nuevo): venta `P.Unit` es **input por tarea**; el desglose `MT/MO/ALB/EQ` se reparte proporcional al costo; `PV subtotal` = `P.Unit × Cant`. (Antes: derivado del coef GGBB `$P$2` — superado.)

> ⚠ **El handoff anterior mencionaba `3_Control_Ppto` como destino de referencias.** Esa hoja **ya no existe** en v8_7 (las `3_*` se eliminaron al pasar a Excel=DB). Cualquier spec que la nombre está desactualizado.

---

## 7. Entorno de trabajo en Claude Code

**Decisión:** continuar en el proyecto existente `arquinering-migracion` (no crear carpeta nueva), **pero limpiarlo**.

Razón: el contexto acumulado (`CLAUDE.md`, `recalc.py`, `utils.py`, convenciones, specs) es valioso y re-crearlo sería perder terreno. Pero el nombre "migración" ya no describe el proyecto: mutó de *migrar los resúmenes a v8* a *construir el ecosistema web + Excel-base-de-datos + app de certificación*.

**Criterio de limpieza (no lista rígida):** Claude Code debe interpretar qué archivar según el **objetivo nuevo** (base de datos + dashboard + app de certificación), porque tiene a la vista el árbol real de archivos. Lineamientos:
- **Conservar** lo vigente y de contexto: `CLAUDE.md`, `recalc.py`, `utils.py`, specs vigentes (certificación v8), v8 actuales de GDR y CH, APU Unificado.
- **Archivar** (mover a `_archivo/`, **no borrar**) lo superado: versiones intermedias de migración, mockups viejos del dashboard, iteraciones muertas.
- **Actualizar `CLAUDE.md`** para que refleje el alcance nuevo, no "migración".

---

## 8. Principios de ejecución (recordatorio, de decisiones previas)

- Arquitectura se debate en chat; la ejecución se hace en Claude Code.
- `delete_rows`/`insert_rows` prohibidos (corrompen referencias de fórmula); filas nuevas al final del rango.
- `recalc.py` debe dar **0 errores** después de cada bloque antes de continuar. Un solo `wb.save()` por bloque.
- Formula-pure: sin valores pegados sobre fórmulas, sin macros, compatibilidad Excel 2016+ (XLOOKUP disponible).
- `data_only=True` para leer con openpyxl; carga por defecto (preserva fórmulas) para escribir.
- No modificar columnas congeladas en PARTIDAS (T/U/V en CH) ni en PPTO_GENERADOR.
- CAC: actualizador = mes/base (no el inverso).
- Codificación de color de celdas: azul = input manual, verde = referencia externa, negro = fórmula interna, gris = valor estático, fondo amarillo = pendiente/alerta.

---

## 9. Pendientes abiertos

- Valores del índice CAC (INDEC) de meses recientes a actualizar.
- Alineación de nomenclatura de rubros de Tezamat entre todas las herramientas.
- Tratamiento de optimización de Gastos Directos e Indirectos (evaluar maestro compartido, §1.2).

---

## 10. Reconciliación handoff vs. archivo real v8_7 (resoluciones)

El circuito Cert_* ya está implementado y evolucionó hasta **v8_7**, más allá del `ESPEC_Circuito_Certificacion_v8.md` (congelado en v8_1) y de la primera versión de este handoff. Tras inventariar el archivo real, los seis puntos de empate se resolvieron así:

| # | Punto | Resolución | Acción |
|---|-------|-----------|--------|
| 1 | Nomenclatura Blanco/Negro vs con/sin factura | **Gana el archivo.** Blanco/Negro es real; con/sin factura es glosa. | Handoff adaptado. Sin cambio en archivo. |
| 2 | Formato de ID (`-C{NN}` vs `-CERT-{NNN}`) | **Gana el archivo:** `{OBRA}-{OC}-C{NN}` + `-B`/`-N`, anticipo `…-ANT`. | Handoff adaptado. Sin cambio en archivo. |
| 3 | Desacopio por rama vs a nivel madre | **Gana el handoff.** Desacopio es uno solo por certificación, lo fija DO sobre la madre. | **Cambio en archivo** (migrar de col J por-rama a madre). → addendum. |
| 4 | CAC editable | **Mejora.** Fórmula por defecto + override manual. | **Cambio menor en archivo.** → addendum. |
| 5 | Estado (máquina persistida vs semáforo) | **Gana el archivo.** Semáforo computado por fórmula. | Handoff adaptado. Sin cambio en archivo. |
| 6 | Conciliación contra `2_Movimientos` + doble registro base/CAC + strings Tezamat | **Funcionalidad nueva.** Hoy no existe en el archivo. | **Construcción nueva.** → spec propio. |

**Plan de ejecución resultante — dos documentos separados:**
- **Addendum de ajustes** (puntos 3, 4 + estructurar `id_factura` y columnas de `Cert_Facturacion`): ajustes acotados sobre estructura existente, bajo riesgo, `recalc.py` y listo.
- **Spec de conciliación Tezamat** (punto 6): construcción nueva. Acá está el diseño de fondo — cómo modelar el doble registro base/CAC, cómo matchear contra el extracto crudo de `2_Movimientos`, qué reemplaza al flag manual `Conciliado` (Sí/No) actual, y la tabla única de cobros con `monto_ars_equiv`.

> El `ESPEC_Circuito_Certificacion_v8.md` queda como **referencia histórica** (describe v8_1). No usarlo como spec de ejecución; está superado por el archivo real y por este handoff.
