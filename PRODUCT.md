# Brickly / Groundwork — Guía de Producto

> Documento de contexto de **producto** (no técnico) para nuevas sesiones de Claude.
> El "qué/cómo del código" vive en `CLAUDE.md`. Acá vive el **por qué**: quién es el
> cliente, cuál es el problema real, qué decidimos construir y en qué orden.
>
> Estado: **documento vivo**. Última revisión: 2026-05-29.

---

## 1. El cliente y el problema

**Arquinering S.R.L.** es una PyME argentina que es a la vez estudio de arquitectura,
constructora y desarrolladora. Construye edificios residenciales en CABA bajo
**fideicomiso inmobiliario**. Maneja **1–3 obras simultáneas**, presupuestos de
**$500M–$1.500M ARS**, 4–8 personas en oficina y 15–40 en obra.

Particularidad clave: tiene **doble sombrero** — es la constructora que ejecuta *y* la
administradora de los fondos del fideicomiso. Por eso necesita **control financiero y
rendición de cuentas** (a inversores/beneficiarios) que va más allá de una constructora
pura: certifica avance, factura al fideicomiso, y debe poder mostrar trazabilidad.

### Conceptos del dominio (glosario rápido)
- **APU** (Análisis de Precio Unitario): descompone una tarea en materiales + mano de obra
  (MO) + equipos, y da un **precio unitario** ($/m², $/m³, $/u). Arquinering tiene un
  **APU maestro** (Excel, ~90 partidas activas, 102 hojas, VLOOKUP a tablas de precios).
- **Rubro**: el eje de control real (Hormigón, Albañilería, Eléctrico, Sanitaria…). En
  Argentina la PyME controla **por rubro, no por tarea**. Los pagos, la MO y los
  contratistas se imputan a rubro.
- **GGBB** (Gastos Generales y Beneficio): todo lo que no es costo directo. Genera el
  **coeficiente K** (GDR 3760: K=1.3327) que convierte costo → **precio de venta** al fideicomiso.
- **CAC**: índice mensual del INDEC. El presupuesto se fija a un mes base; los pagos reales
  se **deflactan** a moneda base para comparar contra presupuesto. La inflación se gestiona
  **solo con CAC**, no reajustando el APU.
- **Certificación**: medir avance físico → calcular monto a cobrar (base + CAC + IVA) →
  facturar al fideicomiso.
- **Acopio**: control de stock de materiales en obra (entra / se usa / queda).
- **Tezamat**: sistema contable donde Administración registra pagos. (Hoy sin centro de
  costo por obra para sueldos.)

### El flujo de punta a punta (14 etapas)
`APU → Presupuesto al costo → GGBB → Presupuesto de venta → [CAC] → Requerimiento de
compra → Compra/OC → Pago → Acopio → MO interna → Contratistas → Certificación/Facturación
→ Cash Flow → Resumen de obra`

### La tesis central del proyecto
> **"El dato que viaja."** Cada dato se carga **una sola vez**, en el punto más cercano a
> donde se origina; fluye **automáticamente** a todos los consumidores; cualquiera
> autorizado puede **consultar** el estado en tiempo real.

Hoy el dato **no viaja**: cada área recarga la info desde cero, en su formato, con sus
errores y su retraso. La información vive en silos (Excel + Tezamat + mail + WhatsApp +
planillas de MO).

---

## 2. Qué decidió construir el cliente (scope de corto plazo)

> **Decisión de producto (Pablo, 2026-05-29):** el corto plazo es un **cockpit de
> planificación congelada multi-obra**, de consulta. NO se persigue captura de datos
> operativos (el jefe de obra NO va a cargar "compré esto" ni "terminé esta tarea" en el
> corto plazo — eso está **explícitamente fuera de scope**).

El cliente pidió, textualmente:
- Presupuestos de varias obras cargados, con **vistas claras de cantidades** (materiales,
  MO, equipos) para controlar las cantidades estimadas.
- **Seguimiento de 3–5 obras en paralelo** ("esta obra va por el mes 3, esta otra por el 7").
- **Anticipar compras**: ver qué insumos se van a consumir en cada mes y comprar por adelantado.
- Consultar en todo momento un **plan congelado** (lo presupuestado + lo planificado) para
  analizar desvíos.

El producto es un **panel de control interno de Arquinering, de lectura, consumido por
muchos roles** (CEO, jefe de obra, encargada de compras…), donde cada uno ve lo que necesita.

### El dolor cuantificado (referencia del PDF — contexto, no scope inmediato)

El PDF cuantifica el "costo oculto de la ineficiencia". La mayor parte vive en la mitad
operativa/de ejecución del flujo (etapas 6–14). Es el **norte de mediano plazo**, no lo que
se construye ahora:

| Ineficiencia | Impacto |
|---|---|
| Retrabajo por carga manual duplicada (Tezamat + Excel + mail + planilla MO) | **8–16 h/mes por obra** |
| Decisiones con datos desactualizados | Potencialmente alto |
| Errores por fórmulas frágiles y valores pegados | **$2–10M por error no detectado** |
| Requerimientos sin estructura → compras ineficientes | **5–15% de sobreprecio** |
| Falta de trazabilidad pago ↔ origen | Riesgo de auditoría (fideicomiso) |
| Tiempo del coordinador armando reportes | **4–8 h/mes por obra** |
| No control de acopio vs. compras | Desperdicios no detectados |

**Implicancia de producto:** el dolor operativo es alta frecuencia y muy medible, **pero el
cliente no quiere (todavía) capturar datos operativos**. Por eso el corto plazo entrega valor
desde el *otro* ángulo: convertir el plan congelado en **proyección consultable** (sobre todo
la necesidad de insumos por mes y consolidada entre obras — ver §6), que se computa con datos
que ya tenemos y **no exige cambio de comportamiento de nadie**.

---

## 3. Estado actual del producto (honesto)

La web hoy cubre **muy bien la mitad de planificación** y **nada de la mitad operativa**.

**Construido (etapas 1–4 + cronograma):**
- Schema sólido: `Insumo` / `Partida` / `Composicion` / `Obra` / `PresupuestoHeader` /
  `LineaPresupuesto` / `Planificacion` / `LineaCronograma`.
- Import del **APU Unificado** (xlsx) → crea Obra + Presupuesto + catálogo en un paso.
- Normalización IA pre-import (rubros canónicos, dedup de insumos por embeddings).
- Vistas: Dashboard, Obras, Presupuesto (CD/PV/MAT/MO/EQ por rubro), Partidas, Catálogos,
  Planificación, Import.
- Buen instinto ya codificado: `precioUnitarioSnapshot` + congelar al aprobar = exactamente
  lo que pide el PDF (no vincular el presupuesto al APU de forma dinámica permanente).

**Falta para completar el cockpit de corto plazo:**
- La **vista de necesidad de insumos por mes / por obra / consolidada entre obras** (el quick
  win — ver §6). El backbone (composición + cronograma + cantidades) ya está; falta la query
  de agregación y la vista.
- Vistas de **cantidades** de insumos (no solo $): "esta obra consume N de cemento en total".
- Vista **portfolio multi-obra** alineada por calendario ("mes 3 / mes 7").

**Fuera de scope de corto plazo (decisión del cliente):**
- Captura operativa: Requerimientos, Compras/OC, Pagos, Acopio, MO, Contratistas, certificación.
  Es el mediano plazo (§6 north star), no ahora.

**Riesgos a vigilar:**
1. **Dashboard que parece control pero no lo es:** el "avance/desvío" de hoy es
   teórico-de-cronograma. Mientras no haya feed de realidad, hay que rotularlo como
   **"planificado/esperado"**, no como "real", para no aparentar un control que no existe.
2. **Sobre-inversión en parsers per-obra:** importar Excels per-obra es migración, no producto
   recurrente. Ver §4 (humano en el loop + formato de staging).

El backbone catálogo+presupuesto+cronograma es exactamente el sustrato que necesita el cockpit.
Es **fundación bien puesta**; lo que falta es la capa de proyección y consulta encima.

---

## 4. Estrategia de archivos / ingestión

Existen **dos tipos de archivo muy distintos** y conviene tratarlos diferente:

1. **APU maestro (general):** catálogo vivo, reutilizable entre obras, se actualiza por
   precios. → **Esto sí debe alimentar el sistema como catálogo.** Importar periódicamente.
2. **Archivos per-obra** (presupuesto de obra, aprobado + cashflow): outputs de UN proyecto.
   → El objetivo es que la web los **genere**, no que los consuma para siempre.

**El "APU Unificado"** (20 hojas) lo armó el equipo de desarrollo para tener un target de
parseo limpio. Matiz importante (revisado 2026-05-29): **el unificado NO es el enemigo.** El
error sería pedirle a *Arquinering* que viva en ese formato (eso sí sería darles más trabajo
de Excel). Pero como **formato de staging que generamos nosotros** (script / Claude) a partir
de sus archivos reales al momento de importar, es **buena ingeniería** — es nuestro parse
target, no su carga de trabajo.

**Estrategia de entrada a Arquinering (su constraint: no van a dejar Excel ni adoptar la web
como herramienta de trabajo):**
- **La web es una capa de *consulta* encima de su Excel, no un reemplazo.** Siguen laburando
  igual; la web es donde *todos consultan*. Esto baja drásticamente la resistencia al cambio.
- **No pedirles mantener nada nuevo.** Recibimos los archivos que ya producen.
- Como presupuestar es **baja frecuencia** (3–5 obras/año), un **paso de conversión con humano
  en el loop por obra** (sus archivos → unified → import) es aceptable y de-riskea el parseo
  frágil de sus Excels desprolijos. Un poco de retrabajo controlado, OK si vale la pena.
- Lo único que conviene estandarizar de verdad es la **estructura del APU maestro** (backbone
  compartido entre obras).
- **Estado objetivo (mediano plazo):** que los presupuestos per-obra **nazcan en la web** desde
  el catálogo, y se congelen al aprobar. Pero no se fuerza ahora; se gana el derecho entregando
  valor de consulta que sientan primero.

---

## 5. Principios de producto (no negociables)

1. **Cargar una vez, en el origen.** Cada feature nueva debe ser un punto de captura, no una
   re-transcripción.
2. **Congelar al aprobar.** El presupuesto aprobado es inmutable; queda con referencia
   ("generado desde APU enero 2026"). La inflación se gestiona solo con CAC.
3. **CAC vive en la capa de análisis, no en la contable.** Tezamat registra pesos corrientes
   tal cual hoy; la deflactación ocurre afuera, al comparar contra presupuesto.
4. **El rubro es el eje de control.** Desvíos, MO, contratistas y pagos se imputan y analizan
   por rubro (la tarea individual es evolución futura).
5. **No construir "control" sin gasto real detrás.** Un semáforo de desvío sin pago real es
   peor que no tenerlo.
6. **Medible o no se hace.** Cada win define su métrica antes de construirse.

---

## 6. Roadmap

> Filosofía: elegir **un** hilo operativo y construir su **rebanada vertical más fina** que
> remueva un dolor diario y produzca un número. Nada de plataformas grandes.

### Quick win de corto plazo (lead): proyección de insumos multi-obra
**Necesidad de insumos por mes, por obra y CONSOLIDADA entre obras.**
> "En mayo 2026, sumando GDR (mes 3) + Chivilcoy (mes 7), se necesitan 1.200 bolsas de
> cemento, 18.000 ladrillos, 40 jornales de oficial albañil."

- *Cómo se computa (datos ya cargados):* para cada `LineaPresupuesto` con `partidaId`, y cada
  mes `m` del `LineaCronograma`:
  `qty(insumo i, mes m) = Σ linea.cantidad × pctEjecucion(m) × composicion.cantidadPorUnidad × (1 + pctDesperdicio)`,
  sumado entre líneas y entre obras (alineado por fecha absoluta del cronograma).
- *Da materiales, MO y equipos* (por `Insumo.tipo`). En $ y en cantidad.
- *Por qué es el win correcto:* es lo que el cliente pidió (anticipar compras, ver el mes de
  cada obra), **no exige captura operativa de nadie**, y es el payoff del trabajo de import.
- *Métricas:* ¿anticiparon compras?, ¿bajaron compras de urgencia (las caras)?, consultas/mes
  por rol.
- *Limitación honesta:* líneas sin `partidaId` (cotización directa / libre) aportan $ pero no
  explotan en insumos. Y sin cronograma cargado, solo hay totales de obra, no fase mensual.

Otras vistas del mismo cockpit: **portfolio multi-obra** (timeline alineado por calendario),
**cantidades totales de insumos por obra**, presupuesto congelado consultable por rol.

### North star (mediano plazo — cambiante, no sobre-diseñar)
Cuando el cliente quiera **desvío contra realidad**, el feed más liviano es el **requerimiento
de compras** (que ya es consumidor natural del panel). De ahí, el pipeline del PDF:
Requerimiento → OC → Pago (deflactado por CAC) → control de desvíos por rubro → Certificación
→ Cash Flow → resumen automático → (eventual) portal para el inversor. Dejar el modelo de
datos listo para enchufar ese feed sin rediseñar.

---

## 7. Decisiones tomadas

**2026-05-29:** Tezamat y asistencia digital → más adelante. Captura operativa del jefe de
obra → fuera de scope corto plazo. Sistema = panel interno multi-rol de consulta.

**2026-05-30:**
1. **Cobertura de cronograma:** el aprobado+cashflow es un artefacto **estandarizable**. Se
   define un **formato estándar** y se corrigen los existentes (GDR, Chivilcoy). → toda obra
   entra con cronograma; la proyección mensual de insumos es siempre viable.
2. **Granularidad:** "% por tarea por mes" alcanza. La proyección es **apoyo a la decisión de
   compra** ("el plan anticipa que en junio necesitás ~X"), no una orden. Tono: preview, no mandato.
3. **Import → APU Unificado como staging.** Sus archivos crudos son desprolijos/incompletos/
   hardcodeados; NO se construye parser de crudos. Contrato: (a) dos formatos estándar
   documentados (APU maestro y aprobado+cashflow); (b) conversión raw → Unificado asistida por
   Claude/script, operada por nosotros; (c) la web solo importa el Unificado (ya funciona).
   Primera migración: GDR y Chivilcoy al estándar.
4. **Roles → una sola app, segmentada por *vista*, sin permisos todavía.** Todos autenticados,
   todos ven todo. Tres lentes: **Portfolio** (dirección), **Insumos/Compras** (la vista nueva),
   **Obra** (jefe/técnica). RBAC real solo cuando haya consumidor externo (inversor vía link).

### Abiertas
- ¿El Unificado de **Chivilcoy** ya está importado, o se importa primero?
- **APU maestro:** ¿frecuencia de actualización de precios? ¿quién lo mantiene?

**2026-05-30 (respuestas que fijan diseño):**
- **Cronograma editable a mano** (para corregir errores / actualizar), pero debe haber **una
  sola fuente de verdad** (el aprobado importado), no dos modelos en paralelo. → Fase 4.
- **Identidad de insumos:** las tareas/insumos **generales** usan código canónico del APU
  maestro y ese código **es el mismo** en el presupuesto de cada obra (no se renombra). Las
  tareas **específicas** de obra inventan su código. → la consolidación multi-obra suma bien
  por código para lo canónico; **no hace falta dedup semántico con IA** para el quick win.
- **Cotización directa / libre:** habrá muchas, sobre todo **subcontratos, equipos y MO** (y
  algunos materiales). → la proyección de cantidades cubre solo líneas con partida APU; el
  resto se muestra como monto, sin explosión de insumos. Hay que ser explícito en la UI.

---

## 8. Changelog de producto

> Regla: cada cambio que afecte el producto se registra acá (y, si toca arquitectura, en CLAUDE.md).

### Fase 1 — Corrección y honestidad (2026-05-30)
Objetivo: que los números que se ven sean reales y que nada aparente un control que no existe.
- **Pricing centralizado, fin del K hardcodeado.** Se eliminó la constante `MARKUP_FACTOR = 1.3327`
  (el K de GDR) de `dashboard.routes` y `obras.routes`. Nuevo `backend/src/lib/pricing.ts`:
  el precio de venta usa el `precioVenta` congelado de la línea si existe; si no, costo directo ×
  `coefGGBB` del header (fallback 1, nunca una constante de obra). **Validar:** GDR debería quedar
  igual (su K es 1.3327); Chivilcoy ahora refleja su propio K.
- **Bug del import corregido:** el import parseaba `precioVenta` por línea pero **no lo guardaba**.
  Ahora lo persiste. Toma efecto al **re-importar** (las obras ya cargadas siguen usando el fallback
  CD×coef hasta re-importar).
- **Honestidad de etiquetas:** "Avance/Ejecutado a hoy" → "Avance previsto / Previsto a hoy" en
  Dashboard y Obra. Es plan, no realidad (no hay feed de ejecución real todavía).
- **Curva S real:** el backend (`/:id/cronograma`) ahora devuelve `serieMensual` (acumulado real
  derivado del cronograma); el frontend dejó de dibujar una recta inventada.
- **IA muerta eliminada:** se borró `backend/src/services/ai/*` (no lo importaba nadie; el campo
  `embedding` se insertaba vacío). La IA se reincorporará donde gane de verdad (conversión
  raw→unified offline), no como infra viva en el backend. *(Pendiente opcional: quitar el campo
  `embedding` del schema vía migración y la dep `@google/genai`.)*
- Limpieza menor: expresiones no-op (`{void ...}`) y props muertas.

### Fase 2 — Quick win: Proyección de insumos (2026-05-30)
- **Vista nueva `/proyeccion`** (nav "Proyección de insumos"): matriz insumo × mes, consolidada
  entre obras (alineada por mes calendario), con filtros obra/tipo, búsqueda, toggle cantidad/$,
  resaltado de "próximos 2 meses" y una tarjeta de anticipación de compra. Solo lectura.
- **Endpoint `GET /api/insumos/proyeccion?obraId=&tipo=`** — explota composición→insumo por mes.
  Reusa `calcCantInsumo`, extraído a `backend/src/lib/composicion.ts` (antes duplicado en obras.routes).
- **Honestidad:** muestra **cobertura** (% del costo directo con composición APU); las líneas de
  cotización directa (subcontratos/equipos/MO sin composición) no se desglosan.
- **Validado** con Playwright headless: endpoint 200, render OK, filtros/toggle OK, 0 errores.

> ⚠️ **BLOQUEANTE descubierto en Fase 2 — no hay ingesta de cronograma.**
> `LineaCronograma` **no la escribe ningún código** (se cayó en el refactor "APU Unificado única
> fuente"). El unificado **no contiene** el cashflow; el cronograma vive en el archivo
> **aprobado+cashflow separado** (`AING - GDR3760 01 APROBADO.xlsx`, hoja `Proyeccion - Venta`,
> columnas MES 0..N). Sin ingesta, la Proyección **y** el Dashboard temporal salen vacíos.
> Para validar Fase 2 se usó cronograma **sintético** (ya borrado). **Próximo paso obligado:**
> construir la ingesta del cronograma (recomendado: incorporarlo al formato unificado vía la
> conversión raw→unified, una sola vía de import — ver §4).

> 🐛 **Hallazgo de calidad de dato (la herramienta funcionando):** la proyección expuso una
> composición corrupta — partida `PTO-2304` "Tabique divisorio" lista **8192.682 "Escalera" por
> unidad** → $519.000M. Celda corrida en el Excel de origen. Es el vicio de "valores pegados"
> del PDF, ahora detectable. Corregir en la fuente / en la conversión.

### Fase 2.1 — Cronograma en el unificado (paso 1: conversión) (2026-05-30)
Se resolvió el origen del cronograma sin pedirle nada nuevo a Arquinering: un script offline
toma su archivo aprobado+cashflow y lo inyecta en el APU Unificado (el paso raw→unified de §4).
- **`backend/scripts/inject-aprobado.ts`** (dry-run + `--write`): lee la hoja de cashflow del
  aprobado, extrae por ítem el **precio de venta** y el **% de ejecución por mes calendario**,
  y agrega una hoja **`PPTO_APROBADO`** al unificado. Fija el **K** correcto en PPTO_GENERADOR.
- **K por obra (del GGBB del presupuesto interno):** GDR **1.3327**, CH **1.3565** (el unificado de
  CH tenía 1 — corregido). Validación: Σ precio de venta por ítem = A+B del GGBB con <0.01% de
  diferencia en ambas obras → precios y K correctos.
- Archivos generados: `APU_Unificado_GDR3760_VF_conAprobado.xlsx` (18 meses, 183 ítems con
  cronograma) y `APU_Unificado_CH2171_v4_4_conAprobado.xlsx` (21 meses, 171 ítems). Originales intactos.
- Quirk de origen: ~8 ítems de GDR (24.01/03/05…) suman 102% — se deja fiel al dato, no se
  normaliza en silencio.
### Fase 2.2 — Import del cronograma + cierre de Fase 2 (2026-05-30)
El import ahora lee la hoja `PPTO_APROBADO` y materializa la dimensión temporal:
- **`apu-import.service.ts`**: nuevo `parsePptoAprobado` + persistencia de un **header APROBADO**
  (espejo de las líneas del generador) con `LineaPresupuesto.precioVenta` real (precio aprobado,
  match por nº de ítem) y **`LineaCronograma`** por mes (pctEjecución, fecha calendario absoluta).
  Idempotente (borra/recrea APROBADO en cada import). `calcCantInsumo` ahora en `lib/composicion.ts`.
- El endpoint de proyección y el resto prefieren el header **APROBADO** (trae cronograma + venta).
- **Re-import real GDR + CH** (archivos `_conAprobado`): 1334 filas de cronograma, 2 headers
  APROBADO + 2 GENERADOR. `precioVenta` = precio aprobado exacto (ej. GDR ítem 1.04 = $256.997).
- **Validado en la app con datos reales** (Playwright): `/proyeccion` 200, **31 meses consolidados
  entre obras** (feb-25→oct-27), 293 materiales, cobertura **94%**, 0 errores. El Dashboard y el
  avance de obra también pasan a tener datos temporales reales.

> 🐛 **Pendiente de dato (no de código):** la composición de `PTO-2304` "Tabique divisorio" sigue
> con **8192.682 "Escalera" por unidad** → infla el total a $519.000M y domina la proyección.
> Hay que corregirlo en la **hoja COMPOSICIÓN del unificado** (la fuente), no en la DB. Decidir
> el valor correcto con Arquinering.

### Fase 3 — Estructura obra-céntrica (2026-05-30)
El presupuesto y el cronograma se ven **dentro de la obra** (inline), no redirigiendo a `/catalogo`.
- **`ObraDetailPage`**: tab Presupuesto = desglose **MAT/MO/EQ/PV por rubro** (colapsable) desde
  `/:id/presupuesto`. Tab Planificación = cronograma inline desde `/:id/cronograma`: Curva S real,
  selector de mes, avance previsto por rubro, **insumos del mes** (antes calculados y descartados)
  y tareas previstas del mes. "Ver presupuesto" ya no expulsa a una URL global.
- **Sidebar**: Catálogo queda solo con lo global (Partidas, Insumos, Importar). Presupuestos y
  Planificaciones salieron del menú (viven dentro de cada obra).
- 🐛 **Bug corregido (regresión de Fase 1):** la columna "Precio Venta" del PPTO_GENERADOR es un
  **total de línea**, pero se guardaba en `precioVenta` (que el sistema trata como **unitario**) →
  el precio de venta se inflaba ×cant ($2.998B / hasta $261B en vez de $1.345B). Ahora: el
  generador deja `precioVenta=null` (se deriva CD/ud×K) y el APROBADO usa el **PV/ud real** del
  aprobado. Además el APROBADO se construye desde los **ítems del aprobado** (no espejando el
  generador), incluyendo 17 ítems contractuales que el generador no tiene. **Total de venta ahora
  EXACTO**: GDR $1.345.752.968, CH $1.540.623.004 (= Σ del aprobado). 1401 filas de cronograma.

### Fase 4 — Cronograma editable + retiro de Planificacion (2026-05-30)
Una sola fuente de verdad temporal, editable a mano (para corregir/actualizar).
- **Modelo `Planificacion`/`PlanificacionFila` retirado** (migración `retire_planificacion` dropea
  ambas tablas). Eliminados: `planificacion.routes.ts`, su mount en `index.ts`, `PlanificacionPage.tsx`
  y todas las rutas/redirects `/planificacion*` de `App.tsx`.
- **Cronograma editable** sobre `LineaCronograma`:
  - `GET /api/obras/:id/cronograma/matriz` → matriz tarea × mes (% por mes) del header APROBADO.
  - `PUT /api/obras/:id/cronograma` → reemplaza el cronograma del header (transacción delete+create).
  - Frontend `components/CronogramaEditor.tsx`: matriz editable (% por mes, suma por fila con
    validación ~100%, distribuir/limpiar). Botón "Editar cronograma" en el tab de la obra.
- **Validado**: matriz 200 (17 meses × 191 tareas), edición + guardado PUT 200 `ok:true`, 0 errores.

### Validación del parser (2026-05-30)
- **Skill `/validate-parser`** (`.claude/skills/validate-parser/` + motor `backend/scripts/validate-parser.ts`):
  compara los `_conAprobado.xlsx` contra la DB local número por número (generador, aprobado,
  cronograma, totales, conteos de catálogo). Solo lectura. Agrega por item# (robusto a repetidos).
- **Resultado actual: todo ✓.** GDR (183 gen / 191 apr / 621 crono) y CH (187 / 173 / 780); Σ CD y
  Σ PV exactos. Hallazgo informativo: CH tiene 11 nº de ítem repetidos (24.01–24.09, 25.01–25.02 —
  Sereno/Técnico H&S); el import los suma bien y el total coincide con el GGBB.
- **Sección "Sanity" (interpretación):** además de comparar Excel⟷DB, el skill marca candidatos para
  que Claude los juzgue con criterio del rubro (top insumos por monto, costo-por-unidad-de-partida
  explosivo ≥$20M = patrón Escalera, concentración 1-insumo≥90% de una partida). No auto-falla por
  "número grande": un millón de ladrillos es plausible, un millón de escaleras no.

### "Escalera" — RESUELTO (no era la fuente)
El `OTR-PTO015 = "Escalera" $274.291` que inflaba la proyección a $519.000M era **catálogo viejo**
de los primeros imports. En la fuente (`MATERIALES`) `OTR-PTO015` siempre fue **"Materiales varios",
gl, $1** (en composición la columna Cant = monto en pesos). Los re-imports posteriores ya lo
corrigieron por upsert. Verificado: hoy aporta $2.6M, no $519.000M. No hubo que editar la fuente.

## Estado: fases 1–4 del plan completas + validación de parser con sanity. App con datos reales (GDR + CH).
