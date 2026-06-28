# EMPEZAR ACÁ — Handoff del proyecto "Resumen de Obra v8 + Dashboard"
# Arquinering S.R.L.

> Si estás leyendo esto, te pasaron el proyecto para continuarlo. Esta es la guía de arranque.
> Leé en el orden de abajo y vas a tener todo el contexto.

---

## 1. Qué es este proyecto (en 30 segundos)

Es el **ecosistema de control de obra** de Arquinering, con 3 capas:
1. **Excel = base de datos** por obra (formula-pure, auditable). El archivo vigente es
   `archivos/output/CH_2171_Resumen_de_Obra_v8_11.xlsx` (obra Chivilcoy 2171).
2. **Dashboard web** (`dashboard_v2/`, Python + Flask) que **lee ese Excel y recalcula** los KPIs.
3. **App de certificación de avance** (todavía NO existe — es uno de los pendientes).

Vos ya trabajaste en el **APU Unificado** (el que arma la hoja `Composicion` del resumen). Eso ya está.
Lo que sigue es todo el resto: el resumen de obra v8, la conciliación con Tezamat y el dashboard.

---

## 2. Orden de lectura (importante, hacelo en este orden)

1. **`CLAUDE.md`** (raíz) — el contexto maestro: dominio (APU, CAC, UOCRA, fideicomiso, plan de cuentas
   Tezamat), principios técnicos no negociables, estructura de archivos, y un registro de **decisiones tomadas**.
2. **`docs/HANDOFF_flujo_resumen_v8.md`** — el flujo completo de punta a punta (el "qué" y el "porqué").
3. **`logs/pendientes.md`** — ⭐ **TU LISTA DE TAREAS.** Todo lo que falta hacer está acá, con contexto y
   decisiones. Es lo más importante para continuar.
4. **`logs/sesion_2026-06-*.md`** — el historial cronológico de todo lo que se hizo, sesión por sesión.
   Si querés entender cómo se llegó al estado actual, está todo acá (incluida una auditoría integral al final).
5. **`docs/`** — specs de diseño: `ESPEC_Circuito_Certificacion_v8.md` (referencia histórica),
   `SPEC_Conciliacion_Movimientos_v8.md`, `Reconciliacion_Plan_Cuentas_CH2171.md`, manuales.
6. **`dashboard_v2/CLAUDE.md`** y **`dashboard_v2/LOGICA_CALCULO_v8.md`** — cómo funciona el dashboard y de
   dónde sale cada número.

---

## 3. Mapa de carpetas

```
arquinering-migracion/
├── EMPEZAR_ACA.md          ← este archivo
├── CLAUDE.md               ← contexto maestro (leer primero)
├── archivos/
│   ├── fuente/             ← originales (Plan de Cuentas, APU, presupuestos) — solo lectura
│   ├── referencia/         ← GDR v8 (referencia maestra) + APU Unificados
│   └── output/             ← el Excel de trabajo. VIGENTE = CH_2171_..._v8_11.xlsx (+ backups v8_1..v8_10)
├── dashboard_v2/           ← el dashboard web (Flask + JS). Ver §4 para correrlo.
├── scripts/                ← scripts Python (recalc.py = validador; utils.py; migraciones)
├── docs/                   ← specs de diseño y manuales
├── logs/                   ← pendientes.md (TAREAS) + sesion_*.md (historial)
└── memory/                 ← memoria del asistente (si usás Claude Code, la levanta solo)
```
> Nota: NO te pasaron la carpeta `_archivo/` (eran versiones viejas/backups superados). No la necesitás.

---

## 4. Cómo correr el dashboard (para ver el estado actual)

Necesitás **Python 3** instalado. En una terminal, parado en la carpeta del proyecto:

```bash
python -m pip install -r dashboard_v2/requirements.txt   # solo la primera vez
python dashboard_v2/app.py                                # arranca el server
```
Abrí en el navegador: **http://127.0.0.1:5001/ds**
- El dashboard lee el Excel que apunta `dashboard_v2/config/obras.yaml` (hoy: el v8_11 en `dashboard_v2/data/`).
- Si cambiás el Excel, copiá la versión nueva a `dashboard_v2/data/` y actualizá esa ruta en `obras.yaml`.

> ⚠️ Si tocás el Excel con Python (openpyxl), corré después `python scripts/recalc.py <archivo>` (debe dar
> 0 errores) y abrí el archivo en Excel y guardá una vez (para que el dashboard vea los valores calculados).
> Todo esto está explicado en `CLAUDE.md`.

---

## 5. Estado actual y qué falta

**Hecho:** migración a v8, plan de cuentas Tezamat, circuito de certificación (`Cert_*`), conciliación contra
`2_Movimientos`, carga del avance real de la OC01, dashboard funcionando (Control por bloques, Cash Flow,
Avance/Cert, Subcontratos/Jornales, Reporte). Técnicamente sano (auditoría: 0 errores).

**Lo que falta → `logs/pendientes.md`.** Los grandes temas:
- Esperar el extracto de Tezamat corregido (ingresos tagueados) para activar la conciliación de cobros.
- Partición fiscal real + cobros reales de las certificaciones.
- Forecast / EAC y cash-flow proyectado (el mayor valor para Dirección).
- Maestros cross-obra (quincenas, CAC, UOCRA) antes de escalar a más obras.
- La app de certificación de avance físico (todavía no existe).

---

## 6. ¿Usás Claude Code?

Si trabajás con Claude Code, abrí la carpeta del proyecto y va a levantar solo el `CLAUDE.md` y la `memory/`.
Empezá pidiéndole que lea `CLAUDE.md` y `logs/pendientes.md`. Tiene todo el contexto para seguir.

**Contacto:** Pedro (ppagliaricci@gmail.com) para dudas de negocio / decisiones.
