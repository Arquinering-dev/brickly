---
name: dashboard-design-system
description: Dashboard nuevo "Industrial Integrity" (/ds) — frontend DS de Stitch, capa aislada sobre el mismo reader
metadata:
  type: project
---

El dashboard tiene **dos frontends sobre el mismo backend/reader** (`dashboard/`):
- **Legacy** (verde Arquinering): `/` (portfolio) y `/obra/<code>` — `web/index.html`+`portfolio.js`,
  `web/obra.html`+`obra.js`, `web/css/styles.css`. Es la vista en producción.
- **Nuevo DS "Industrial Integrity"** (navy/naranja/sage, Stitch): `/ds` — `web/ds.html`+`js/ds.js`+
  `css/ds.css`. Migración completa 2026-06-15. Fuente de diseño: `dashboard/design/DESIGN_SYSTEM.md`.

**Ruteo `/ds`** (SPA, router por pathname en `ds.js::route()`): `/ds`=Portfolio · `/ds/obra/<code>`=
Dashboard · `/ds/obra/<code>/<módulo>` (control · cash · avance · recursos · reporte). En `app.py::ds_view`.
**7 módulos**: Portfolio · Dashboard · Control Ppto · Flujo de Caja · Avance y Cert. · Compromisos y
Recursos (subcontratos + jornales UOCRA en 2 secciones) · Reporte Ejec. (fideicomiso).

**Componentes base** en `ds.js`: `dsKpi`/`dsKpiWip` · `dsCard` · `dsTable` (densa; `children`/`childCols`/
`rowAttrs`/`total`) · `dsBar`/`barCell` · `dsDot`/`spill` · `dsItip` (ⓘ hover) · `dsWip` · `sparkline` ·
`sidebar`/`topbar`. Tokens en `:root` de `ds.css`; Inter + JetBrains Mono (números mono); elevación tonal.
Drill-downs reusan los endpoints del legacy (`/rubro`,`/mes`,`/etapa`,`/subcontrato`) en drawer DS.
Deep-links: `#drill=Rubro|Tipo`, `#mes=`, `#etapa=`, `#cert=`, `#subc=`.

**Principio rector**: el diseño se adapta al dato real, nunca inventar. Datos que faltan → **slots WIP**
visibles (no ficticios). 3 slots: EAC/forecast · curva planificada ("vs Planned") · avance físico medido.

Único cambio de contrato del reader: `avance_cert_pct` por rubro en `control_ppto` (aditivo; derivado de
`1_Presupuesto`, ver [[composicion-join-key]]). El legacy lo ignora.

Pendientes (otra sesión): export/PDF inertes · conectar slots WIP · decidir si `/ds` reemplaza al legacy.
Detalle en `logs/pendientes.md` y `dashboard/CLAUDE.md` ("Design System — Industrial Integrity").
Verificación visual: screenshot headless de Chrome a `http://127.0.0.1:5000/ds...`.
