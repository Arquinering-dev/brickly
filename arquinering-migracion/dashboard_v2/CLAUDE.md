# Dashboard Resumen de Obra — Arquinering

> ⚠️ **NOTA DE MIGRACIÓN (2026-06-19).** Este archivo nació como el `CLAUDE.md` del dashboard v1
> y se movió acá al jubilar el v1 (ver `_archivo/dashboard/`). El **front DS "Industrial Integrity"**
> y la **lectura anclada por texto** descritos abajo siguen vigentes (v2 los reutiliza). Lo que YA
> NO aplica es el paradigma de datos del v1: v2 **no** lee valores cacheados con `data_only=True`,
> sino que **recalcula todo desde las hojas fuente crudas** (`2_Movimientos`, `Cert_*`, etc.).
> La fuente de verdad de esa lógica de cálculo es **`LOGICA_CALCULO_v8.md`** (contrato del motor) +
> `specs/ESPEC_Circuito_Certificacion_v8.md` (circuito de certificación) + `README.md` (estructura v2).
> Donde este doc y `LOGICA_CALCULO_v8.md` difieran sobre de dónde sale un dato, manda el segundo.

> Vista ejecutiva web que convierte los Resúmenes de Obra v8 (18 hojas por obra) en
> portfolio multi-obra + detalle por obra, para que un socio entienda el estado de cada
> obra en menos de 2 minutos. Leer este archivo completo antes de tocar nada.
>
> Proyecto **anidado** dentro de `arquinering-migracion`. El `CLAUDE.md` padre (migración
> v8) sigue aplicando para todo lo que toque los Excel, el formato v8 y el dominio
> (APU, CAC, UOCRA, fideicomiso, rubros canónicos).

## Stack
- Backend: Flask (`app.py`)
- Frontend: JS vanilla + Chart.js **vendoreado local** (`web/vendor/`, sin build, offline)
- Datos: Excel en `data/` leídos en vivo con openpyxl (`reader/`)
- Config: `config/obras.yaml`

## Estructura
```
dashboard/
├── app.py              # backend Flask: /api/obras, /api/obras/<code>, vistas
├── config/obras.yaml   # registro de obras (única edición para sumar una)
├── data/               # los .xlsx v8 (no se versionan)
├── reader/
│   ├── nav.py          # navegación anclada por texto (helpers)
│   ├── workbook.py     # carga + cache por mtime
│   ├── read_obra.py    # contrato JSON + KPIs derivados + semáforos
│   ├── drilldown.py    # composición de un rubro/contrato/mes/etapa (deep-dives)
│   └── registry.py     # lee obras.yaml y resuelve rutas
├── design/             # design system de Stitch: DESIGN_SYSTEM.md + */screen.png + */code.html
└── web/                # frontend
    ├── index.html · js/portfolio.js   # dashboard LEGACY (verde) — vista actual en producción
    ├── obra.html   · js/obra.js        # detalle LEGACY por obra
    ├── css/styles.css                  # estilos legacy
    ├── ds.html · js/ds.js · css/ds.css # NUEVO design system "Industrial Integrity" (/ds)
    ├── js/common.js                    # helpers compartidos (el, money, pct, fecha, getJSON)
    └── vendor/chart.umd.min.js
```
> No hay `templates/` ni `static/`: Flask sirve `web/` como estático (`static_folder='web'`).
> **Conviven dos frontends** sobre el MISMO backend/reader: el legacy (`/`, `/obra/<code>`) y el
> nuevo DS (`/ds`, `/ds/obra/<code>/<módulo>`). Ver la sección "Design System — Industrial Integrity".

## Fuente de verdad
Los archivos `.xlsx` en `data/` son la fuente de verdad. El lector usa **cache por mtime**:
si el Excel cambia, la cache se invalida sola (guardás en Excel → refrescás → ves fresco).

El dashboard **lee el último guardado** (openpyxl `data_only=True`), **no recalcula fórmulas**.
Gotcha: un `.xlsx` debe estar guardado **desde Excel** para tener valores cacheados; un archivo
generado sólo por openpyxl vendría con celdas calculadas vacías.

## Principios técnicos NO negociables
Esto es lo que mantiene vivo el diseño. Romper cualquiera de estos rompe la multi-obra o
falsea los números:

1. **Lectura anclada por TEXTO, nunca por coordenada fija.** GDR y CH derivan en orden de
   hojas, fila de header, columna de cada métrica, fila de total y wording de etiquetas. El
   lector busca banners/headers y mapea header→columna por palabra clave, e itera hasta un
   centinela ("Total"). Acceder a hojas **por nombre**, jamás asumir la posición de una obra.
   Si "optimizás" a celdas fijas, una obra nueva con otro layout se rompe en silencio.

2. **`3_Dashboard` y los calculados de `0_CONFIG` NO son fuente de verdad.** Tienen layouts
   inconsistentes entre obras y valores rotos en CH. Todos los KPIs se derivan de las hojas
   de control tabulares (`3_Control_Ppto`, `2_Certificaciones`, `2_Subcontratos`,
   `3_Control_Jornales`, `3_Cash_Flow`). De `0_CONFIG` se toman SÓLO parámetros estáticos
   (fechas, K, CAC base, apertura fiscal), leídos como dict etiqueta→valor.

3. **Los semáforos se recalculan en el reader** con umbrales definidos en `read_obra.py`.
   Los glifos guardados en el Excel (⚪/🔴/🟢/🟡) son inconsistentes entre obras — no leerlos.
   El semáforo global (`semaforo_global`) usa **materialidad** (`materialidad()` = 0,5% del ppto
   o $3M, el mayor) y **severidad** (crítico→rojo · atención→amarillo · info): un desvío chico no
   dispara "Riesgo". `razones` = `[{txt, sev}]`; el front pinta los pills por severidad.

4. **Definiciones de negocio congeladas** (confirmadas con Pedro; cambiarlas es decisión de
   negocio → consultar SIEMPRE). **Actualizadas en la auditoría 2026-06-26** (ver sección
   "Estado v2 — post-auditoría" abajo):
   - **Avance físico** = `Cert_Control_OC` col E (% de obra ejecutada, ponderado por venta) —
     `resumen.avance_fisico_pct`. Es el headline. Aparte se expone el **avance financiero**
     (`certificado_avance ÷ ppto_venta`, `resumen.avance_financiero_pct`); difieren cuando hay
     adicionales certificados sin tarea o avance medido sin certificar. NO es ya "cert/venta".
   - **Cobrado** = **tesorería** = ingresos acumulados de `2_Movimientos` (`resumen.cobrado`,
     def. histórica). El cobrado del circuito `Cert_*` se expone aparte como
     `resumen.cobrado_conciliado` (conciliación); si difieren, sale un `data_gap`. NO mezclar.

5. **Agregar una obra = declarar 3 líneas en `obras.yaml` + el `.xlsx`. Sin tocar código.**
   La lectura anclada absorbe el layout. `archivo`: nombre simple → se busca en `data/`; ruta con
   `/` o `\` (ej. `../archivos/output/X.xlsx`) → se resuelve relativa a `dashboard_v2/` y lee DIRECTO
   el archivo de trabajo (sin copia en `data/`). Criterio vigente (2026-06-22): CH y GDR leen directo
   de `archivos/output/`. Cualquier cambio que rompa esto se consulta.

## Cómo correr y verificar
```powershell
python -m pip install -r dashboard/requirements.txt   # primera vez
python dashboard/app.py                                # http://127.0.0.1:5000
```
Verificación visual sin browser interactivo: screenshot headless de Chrome
(`--headless=new --screenshot=... --virtual-time-budget=9000 <url>`) y leer el PNG.

## Deep-dives (drill-down)
Cada sección del detalle permite "doble clic" para ver la composición de un número en un
**drawer lateral** (`web/js/obra.js`). El patrón: clic en una fila/barra → drawer con recap +
barra de consumo color-codeada + tablas de composición. Los semáforos/% se recalculan; el
formato es **compacto en headline (`$1,28 M`) y completo en tablas (`$1.275.976`)**.

| Sección | Disparador | Endpoint / fuente | Muestra |
|---------|-----------|-------------------|---------|
| Control ppto | fila de rubro | `GET /api/obras/<code>/rubro?rubro&tipo` | tareas (`1_Presupuesto`, cada una desplegable a su **composición de insumos** de `1_Composicion`) + gastos (**`2_Movimientos`** por Desc Cuenta — v2; el viejo `2_Gastos`/`2_Quincenas` ya no se usa) + reconciliación. **Bloques GGBB**: cada línea se despliega a las cuentas Tezamat que la componen |
| Certificaciones | fila de cert | item del payload (sin endpoint) | flujo cert→factura→cobro + base/CAC/IVA |
| Subcontratos | fila de contrato | `GET …/subcontrato?contrato` | pagos: `2_Gastos[Contrato]` + `2_Pagos_Quincena_SC` |
| Cash flow | mes del gráfico | `GET …/mes?mes=YYYY-MM` | egresos por rubro + cobros del mes |
| Avance etapa | fila de etapa | `GET …/etapa?etapa` | partidas de la etapa con % certificado |
| Jornales | fila de rubro | `categorias` del payload | horas ppto vs acum por categoría UOCRA |

**Reconciliación (no negociable):** los subtotales del drill-down deben cerrar con la sección
(`3_Control_Ppto`, etc.). Si no cierran, se muestra el delta con un chip ámbar — NO se esconde.
Es lo que hace creíble el dashboard en directorio.

**Hallazgos de datos a recordar** (resueltos en el reader, NO tocar los Excel):
- **`1_Presupuesto` estandarizado (2026-06-24, las 3 obras)**: layout único A:X (ver
  `docs/HANDOFF_flujo_resumen_v8.md` §2.1). **Venta = input por tarea** (`P.Unit`); el avance quedó
  en **una sola** columna `% Acum Tot` (las `Acum_tot $` y el desglose se eliminaron). El reader es
  header-anchored, así que absorbe el nuevo orden; los cambios fueron: `$ certificado` y avance
  per-rubro ahora se computan como `% Acum Tot × PV subtotal` (no hay columna `$` cacheada).
  Las letras de columna citadas abajo (K/L/M/N…) son ilustrativas del layout VIEJO; hoy el costo
  vive en J/K/L/M y la venta unitaria en O/P/Q/R/S — pero el reader las ubica por header, no por letra.
- **`1_Presupuesto`**: las columnas de costo (K/L/M/N) son **por unidad en ambas obras**
  (estándar único desde la *Conversión profunda A*, 2026-06-14: GDR se convirtió de total →
  por-unidad; CH ya lo era). El total es derivado (`Costo_total`/Subtotal = ud×cant). Ya **no
  hay divergencia** total/unidad entre obras. `drilldown.py::_calibrar_cant` sigue auto-detectando
  ×cant contra el total de Control (es robusto a ambos casos y ahora resuelve `usa_cant=True` para
  las dos obras); puede simplificarse más adelante, no es urgente.
- **Composición por tarea** (deep-dive de rubro): cada tarea de `1_Presupuesto` se une a sus
  insumos en `1_Composicion` por el **código de ítem** (`1.02`…). La columna link se detecta **por
  contenido** (la que intersecta el set de ítems `N.NN` de `1_Presupuesto`; el header es
  `Cod_Item_Ppto` pero no se ancla por nombre). Scan COMPLETO de la hoja: en CH las partidas
  linkeadas están después de ~270 filas de catálogo huérfano. **Insumos filtrados por la APERTURA
  de rubro que matchea**, no por el `tipo` del drawer: una tarea aporta su MAT si col A (Rubro MT)
  = rubro, su MO/OTR si col C = rubro, su MO/ALB si col D = rubro (key MAT/OTR/ALB, set `_subs`).
  Así un rubro **sin split MT/MO** (p.ej. "Preliminares", que en el plan es uno solo y vive en
  A+C+D) drillea sus 3 aperturas y **cierra con el Costo de Obra** (antes caía a `tipo=MO` y omitía
  el MAT → drill < total). EQ excluido (decisión 2026-06-13). Costo/ud: MAT y MO/OTR = col Costo;
  MO/ALB = Precio×`Cant MO/ALB Unit`. **Tareas con cant=0 se excluyen** (presupuesto efectivo 0,
  como el Costo de Obra `K*J`). Reconcilia ×cant contra el monto de la tarea; los pocos Δ (insumo
  no presupuestado) se muestran con chip ámbar.
  ⚠ Requiere que `1_Composicion` tenga la col **`Rubro`** (header con "rubro"; XLOOKUP a
  `1_Presupuesto` col D) — sin ella `_jornales` no arma las horas presupuestadas (bug SVD 2026-06-26).
- **Costo real de MO** = `2_Gastos` (subcontrato/OTR) **+ `2_Quincenas`** (nómina propia UOCRA,
  keyed por Rubro). CH codifica el rubro de quincenas distinto (`ALBAMO`, `HORMIMO`) → no matchea
  por nombre y no suma (consistente con su Control).
- **Pagos a subcontratos**: leer de **`2_Gastos[Contrato]` + `2_Pagos_Quincena_SC`**, NO de
  `2_Pagos_Subc` (es una vista FILTER; con `data_only` puede venir vacía).
- **Egresos del mes**: filtrar `2_Gastos` a `Monto Real > 0` (las filas negativas son ingresos/ajustes).
- **GDR `3_Control_Ppto` es el estándar viejo**: "Acum Real" casi vacío y "Acum Descontado" guarda
  nominal. Por eso el drill-down de GDR flaggea real/deflactado — se resuelve con el retrofit de GDR.
- **Anclas con títulos que colisionan**: hojas cuyo título contiene la palabra del header
  (`SUBCONTRATOS`→"contrato") se anclan por un término único del header (`proveedor`, `monto pagado`).

## Frontend — patrones de UI (`web/js/obra.js`, `web/css/styles.css`)
El frontend es JS vanilla; todo el DOM se arma con el helper `el(tag, attrs, ...kids)`. Patrones
que hay que respetar para mantener la armonía:

- **`dataTable(cols, rows, opts)`** — constructor único de tablas. NO armar tablas a mano.
  - Ordena por el **valor crudo** (`col.get(row)`), nunca por el texto formateado de la celda
    (`$1,28 M` ordenaría mal). Tipo por columna: `num` (mayor↔menor), `text` (A↔Z, con
    `localeCompare` es-AR), `date` (ISO cronológico), `none` (no ordenable). Header con flecha ▼/▲.
  - La fila **Total va en `opts.total`** y queda fija abajo (no entra al sort).
  - **Filas desplegables**: `opts.children(row)→[]` + `opts.childCols` → la 1ª celda recibe un
    toggle ▸/▾ que muestra/oculta las filas hijas. Se usa para agrupar.
  - Drill (abrir drawer) se pasa por `opts.rowAttrs(row) → {class:'drill', onclick}`.
- **Agrupar gastos** (`agrupar()` + `dataTable` con children): la tabla de **gastos incurridos**
  (drawer de rubro) y los **egresos del mes** (drawer de cash flow) se agrupan por **proveedor**
  (fallback a concepto; sin dato → `(sin dato)`) y se despliegan a los movimientos con su fecha.
  Esto además **expone los problemas de carga** de `2_Gastos` (movimientos sin proveedor /
  conceptos no estandarizados) — es trabajo de datos con Arquinering, no del dashboard.
- **Formato de dinero**: `money()` = compacto (`$1,28 M`, 2 decimales, `−` para negativos, sin
  cortes de línea) para **headline/KPIs/recap**; `pesos()` = completo (`$1.275.976`) para
  **tablas de detalle auditables**. `pct(x,dec)` para porcentajes.
- **Color y semáforos**: se recalculan en el front con `consumoClass(p)` (verde <0,85 · ámbar
  0,85–1 · rojo >1). Barras de consumo (`.cbar`/`mbar`) en Control, Subcontratos, Jornales y
  drawers. Banner de sobregiro cuando gastado > presupuesto.
- **Drawers**: un único shell (`ensureDrawer`/`openShell`); cada tipo tiene su `open*Drawer` +
  `render*Drawer`. Deep-links por hash para verificar/compartir:
  `#drill=Rubro|Tipo`, `#cert=ID`, `#subc=SC-001`, `#mes=YYYY-MM-01`, `#etapa=Nombre`, `#jornal=Rubro`.
- **Fechas** (en `common.js`): `fecha()` = `dd/mm/aaaa` nivel movimiento (parseo por partes, sin
  corrimiento de huso) · `mesAnio()` = `mmm aaaa` (mes calendario) · `mesLabel()` = `mmm-aa` (eje
  del chart) · `fechaDato()` = mtime del Excel (frescura del dato, mostrado en topbar/header).
- **Headers de sección sobrios** (blanco + acento verde, sin barra verde sólida ni `▌`). El
  detalle tiene **nav sticky con scroll-spy** (`buildChrome`) + botón "volver arriba". Iconos de
  drill = `›` (no emoji). Orden de secciones: Resumen · Control ppto · Cash flow · Certificaciones
  · Subcontratos · Jornales (Control 2º por ser el core; económico agrupado 3º-4º).
- **Resumen ejecutivo**: 3 barras (avance/tiempo/consumo) + KPIs, incluido **Valle de caja**
  (mínimo del resultado acumulado = pico de financiamiento). El chart de cash flow pinta en rojo
  los meses con caja negativa.
- **Portfolio**: franja de agregado de cartera (totales + obras que requieren atención) y cards
  ordenadas por severidad (rojo → amarillo → verde). Estados de carga/vacío/error contemplados.
- **Responsividad**: media queries para topbar/cards/agregado/barras (`styles.css`, al final).

## Autonomía de ejecución

### Actuar SIN pedir permiso para:
- Leer cualquier archivo del proyecto (.py, .js, .html, .css, .yaml, .json, .xlsx)
- Modificar archivos en `reader/`, `app.py`, `web/` (css/, js/, vendor/)
- Ejecutar el servidor Flask para verificar que arranca
- Correr scripts de prueba o verificación (incluidos screenshots headless)
- Instalar dependencias Python que ya están en `requirements.txt`
- Crear archivos nuevos dentro de la estructura existente
- Aplicar fixes de bugs que no cambian la lógica de negocio

### Consultar SIEMPRE antes de:
- Cambiar el contrato JSON que produce `read_obra.py`
  (meta, resumen, control_ppto, avance_etapa, cash_flow, certificaciones,
  subcontratos, jornales) o el de los deep-dives de `drilldown.py`
- Cambiar la lógica de **reconciliación** de los drill-downs o los **hallazgos de datos**
  documentados arriba (×cant, quincenas, fuente de pagos de subcontratos, etc.)
- Tocar cualquiera de los **Principios técnicos no negociables** de arriba
- Modificar la estructura de `config/obras.yaml`
- Agregar dependencias externas nuevas al stack
- Cambios que afecten cómo se agregan obras nuevas al dashboard
- Decisiones de layout o UX que cambien la estructura de las 6 secciones
  (resumen ejecutivo · control ppto · cash flow · certificaciones · subcontratos · jornales)

### Principio general:
Ejecutá hasta completar el pedido. Presentá el resultado con un resumen
de qué cambió y por qué. No interrumpas para confirmar pasos intermedios
que son consecuencia natural del pedido original.

## Design System — Industrial Integrity (`/ds`) — migración 2026-06-15

Frontend nuevo basado en `design/DESIGN_SYSTEM.md` (generado con Google Stitch). **Capa aislada y
aditiva**: no pisa el legacy, comparte el MISMO backend/reader/contrato. El legacy sigue en `/` y
`/obra/<code>`; el nuevo vive en `/ds`. Migración hecha por fases (auditoría → P0 → módulo a módulo,
cada uno aprobado por Pedro).

**Principio rector de la migración (NO negociable):** el diseño se adapta a los datos que REALMENTE
tenemos, no al revés. Nunca inventar datos ni mostrar visualizaciones vacías/ficticias. Lo que Stitch
dibuja y no tenemos → slot **WIP visible** ("dato no disponible aún"), listo para conectar sin
rediseñar. Lo que tenemos y Stitch no dibuja (jornales, composición, CAC, fiscal) → se conserva con
una vista en el estilo del DS.

**Arquitectura (`web/ds.html` + `js/ds.js` + `css/ds.css`):**
- SPA mínima con router por `location.pathname` (`route()` al final de `ds.js`):
  `/ds` → Portfolio · `/ds/obra/<code>` → Dashboard · `/ds/obra/<code>/<módulo>` → módulo.
  Rutas servidas por `app.py::ds_view` (un solo `send_from_directory(ds.html)`).
- **7 módulos** (sidebar navy): Portfolio · Dashboard · Control Ppto · Flujo de Caja · Avance y Cert. ·
  Compromisos y Recursos (fusión subcontratos + jornales UOCRA, 2 secciones) · Reporte Ejec. (fideicomiso).
- **Componentes base reutilizables** en `ds.js`: `dsKpi`/`dsKpiWip` · `dsCard` · `dsTable` (densa,
  con `children`/`childCols` para filas desplegables + `rowAttrs`/`total`) · `dsBar`/`barCell` (dual-tone
  con marca de plan) · `dsDot`/`spill` (semáforo) · `dsItip` (insight ⓘ en hover) · `dsWip` (placeholder) ·
  `sparkline` · `sidebar`/`topbar`. **Tokens** todos en `:root` de `ds.css`; fuentes Inter + JetBrains
  Mono (números SIEMPRE mono). Elevación tonal (sin sombras pesadas).
- **Drill-downs** reusan los MISMOS endpoints que el legacy (`/rubro`, `/mes`, `/etapa`, `/subcontrato`)
  en un drawer DS (`ensureDrawer`/`openDrawerShell`). Deep-links: `#drill=Rubro|Tipo`, `#mes=`, `#etapa=`,
  `#cert=`, `#subc=`.

**Único cambio de contrato del reader** por esta migración: `read_obra` agrega `avance_cert_pct` por
rubro en `control_ppto.rubros` (derivado de `1_Presupuesto`, `_avance_cert_por_rubro`: Σcert$÷Σpv$ por
rubro MT). Es **aditivo** y el legacy lo ignora. Verificado GDR/CH.

**Margen presupuestado (2026-06-24, aditivo):** `control_ppto.rubros[].margen_pct` (= ΣPV÷ΣCosto por
rubro MT, "—" en filas MO) + `control_ppto.margen_obra` (margen global, referencia de color) + en el
drill de rubro cada tarea trae `margen` (PV÷Costo de la tarea completa) y `pv_tarea`. El front muestra
una columna **"Margen ppto"** en la tabla de Costo de Obra y **"Margen"** en la tabla de tareas del
drawer, con dot de color relativo al margen global de la obra (`margenDotLvl`: <1 rojo · <ref ámbar ·
≥ref verde). Es margen **presupuestado** (PV aprobado ÷ costo aprobado), no rentabilidad realizada.

**3 slots WIP** (datos recomendados a conseguir, ya con su lugar en la UI):
1. **EAC / Current Forecast** (Control Ppto: KPI + card "Budget vs EAC") — estimación de costo al cierre.
2. **Curva de avance/desembolso planificado** (Flujo de Caja: benchmark "vs Planned") — hoy se usa
   tiempo transcurrido como proxy crudo.
3. **Avance físico independiente** (Avance: columna "Físico" separada de la certificación; Reporte: overlay).

**Pendientes del DS** (para otra sesión): botones export/PDF inertes · conectar los 3 slots WIP cuando
llegue el dato · decidir si `/ds` reemplaza al legacy en `/` y `/obra` · (opcional) llevar el estilo de
cards al legacy. Auditoría + matriz de 3 vías completa en el historial; resumen en `logs/pendientes.md`.

## Estado v2 — post-auditoría (2026-06-26)

Auditoría de punta a punta de las 7 vistas + 6 drills (5 tandas). Hallazgos y fixes en
`logs/pendientes.md`. **Cambios al contrato/motor que quedaron vigentes** (todo aditivo salvo
donde se aclara):

- **Deflactación CAC robusta** (`movimientos.py::cac_ratio_map`): la columna de ratio se detecta
  **por contenido** (numérica en (0,2] con el 1,0 del mes base), NO por el header — CH titula
  "Ratio deflactación"/"Mes", GDR/SVD "Indice"/"Escala de tiempo". Antes GDR/SVD quedaban sin
  deflactar (nominal disfrazado). Si tocás esto, no re-anclar por texto del header.
- **`load_movimientos` corta filas de "Total"/subtotal** (cuenta o rubro que empieza con "total").
- **`data_gaps`** (nuevo, top-level del contrato): lista `[{tipo, sev:critico|atencion, detalle}]`
  con huecos que DEBEN verse, nunca rellenar en silencio: `cac` (mes sin índice), `subcontratos`
  (sin tagueo Tezamat), `cobros` (Tezamat sin conciliar a cert), `facturacion` (certificado sin
  facturar/cobrar), `jornales` (horas reales sin presupuesto). El front los pinta en un banner
  🔴/🟡 (`gapsBanner`) en Dashboard/Control/Cash/Avance/Recursos.
- **Cobrado** (ver ppio 4): `resumen.cobrado` = tesorería (2_Movimientos); `cobrado_conciliado` =
  circuito Cert_*. **Avance**: `avance_fisico_pct` (Cert_Control_OC col E) + `avance_financiero_pct`
  (cert÷venta). Ambos con tooltip "i" que explica la diferencia.
- **Cash Flow**: el chart parte egresos en "Egresos (Tezamat)" + "Gastos Dir/Ind" (serie propia,
  por fuera de Tezamat, **sin overlap** verificado), usa tokens de color (`cssVar`), y el drill de
  mes **incluye egresos negativos** (notas de crédito) → reconcilia con la barra. Todo nominal.
- **Control GGBB**: cada línea de Gastos Generales/Directos/Indirectos se **despliega** a las
  cuentas Tezamat que la componen (`rubro.gastos[]`). El mapeo gasto→línea es explícito
  (`GASTO_A_LINEA` + nombre normalizado; `_seccion_de_cuenta` sólo de fallback). Columna
  "Gastado (defl.)".
- **Avance/Cert drill de OC**: el recap (certificación financiera, con anticipo/CAC/IVA) y las
  partidas (avance físico a precio de venta) **NO reconcilian mid-obra** por el adelanto del
  anticipo (desacopio) — es por diseño, convergen al 100%. Se separan y etiquetan con "i" en vez
  de forzar un chip. OC sin partidas (adicionales) muestra nota.
- **Subcontratos**: drill respeta la regla CAC/CS (BASE+ANT descuentan saldo; CAC y **CS** no);
  SC sin pagos → estado **`sin_datos`** (dot gris), no verde "en control".
- **Reconciliación verificada**: drill de rubro 100% (24/24·23/23·23/23), drill de mes 100% (post-fix),
  drill de subcontrato 100%, ledger cert = rollup, base+CAC+IVA = total por cert.

**Pendientes de DATOS (no de dashboard), hoy visibles vía `data_gaps`:** facturación/cobro sin
cargar en las 3 obras · subcontratos sin tagueo en GDR/SVD · jornales GDR sin ppto / SVD >100% ·
CAC nov-2024 GDR · inconsistencia OC-contrato vs Σ-PV en GDR.

## Pendientes vivos
- ~~CH `3_Control_Ppto` ppto costo = $1.109,9M vs esperado ~$381M~~ **RESUELTO (2026-06-13)**:
  los $1.109M son el costo controlable correcto. El ~$381M era el WIP incompleto (el bloque de
  Mano de Obra daba 0 por falta de rubros en cols C/D de 1_Presupuesto). Pedro cargó esos rubros
  y refactoreó el control; el sanity check Δ Ppto Rubros (`C36 − 0_CONFIG!B16`) ahora da 0 ✓,
  validando el número contra la fuente. El dashboard lee fiel y muestra el valor correcto.

> Nota: el refactor de `3_Control_Ppto` (5 bloques, fórmulas dinámicas, filas nuevas como
> Termomecánica, sanity checks) NO requiere cambios en el reader: la lectura anclada por texto
> los absorbe (el loop de rubros corta en "TOTAL", los checks quedan después y se ignoran; los
> headers nuevos —"Desvío $", "Acum. Real"— matchean los keywords de `map_columns`).
