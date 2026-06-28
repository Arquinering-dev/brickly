# Brickly — Sistema de Control de Obra (Arquinering)

## Qué es esto

Sistema interno de gestión de obras para la constructora **Arquinering**. Reemplaza el flujo manual de Excel para presupuestar, planificar y controlar obras de construcción.

**Usuario principal:** Pablo (dueño de Arquinering). Sistema interno, no SaaS.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI |
| Backend | Express.js + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL via Supabase |
| AI | Google Gemini API (embeddings + LLM) |
| Deploy | Vercel (frontend) + Railway (backend) |
| Auth | JWT con bcryptjs |

**Monorepo:** `frontend/` y `backend/` son proyectos independientes. No hay workspace de npm entre ellos.

---

## Estructura del proyecto

```
brickly/
├── frontend/          # React app (Vercel)
│   ├── src/
│   │   ├── pages/     # Una página por ruta
│   │   ├── components/# Sidebar, UI lib (Button, Card, Dialog, etc.)
│   │   ├── hooks/     # useObras, etc.
│   │   └── lib/       # api.ts (fetch wrapper), cn.ts, format.ts
│   └── vercel.json    # SPA rewrite rules
│
├── backend/           # Express API (Railway)
│   ├── src/
│   │   ├── routes/    # partidas, insumos, obras, presupuestos, planificacion, dashboard, auth
│   │   ├── services/  # presupuesto-parser, AI (gemini.client, embeddings, llm)
│   │   ├── middleware/# auth.middleware (JWT)
│   │   └── prisma/    # client.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── scripts/       # create-user.ts, test-import-dry.ts, test-import-live.ts
│   └── Dockerfile     # Para Railway
```

---

## Dominio del negocio

### Entidades principales (Prisma schema)

```
Insumo          → Material, Mano de Obra, Equipo o Subcontrato con precio de referencia
Partida         → Un APU (Análisis de Precio Unitario): unidad de trabajo con su composición
Composicion     → N insumos × M partidas (cantidad + % desperdicio)
Obra            → Proyecto de construcción
PresupuestoHeader → Encabezado de un presupuesto (GENERADOR o APROBADO)
LineaPresupuesto  → Ítem dentro de un presupuesto (cantidad × partida)
LineaCronograma   → Distribución mensual de ejecución de una línea
Planificacion     → Versión editable de cronograma de obra
PlanificacionFila → Fila de planificación (% por mes como JSON array)
```

### Enums importantes

```typescript
TipoInsumo:     MATERIAL | MANO_DE_OBRA | EQUIPO | SUBCONTRATO
TipoPartida:    APU | SUBCONTRATO | COTIZACION_DIRECTA
ScopePartida:   APU (catálogo global) | OBRA (específica de obra)
EstadoObra:     EN_PRESUPUESTO | EN_CURSO | FINALIZADA
TipoPresupuesto: GENERADOR | APROBADO
```

---

## Importación de datos — Resumen de Obra

El formato de Excel que se importa es el **"Resumen de Obra"** de Arquinering (v8+). Entra por
`POST /api/import/resumen` (`?dry=1` para preview). Lógica en
`backend/src/services/resumen-import.service.ts` (`importResumenXlsx`), que además invoca
`resumen-parser.service.ts` (`parseResumenObra`, hojas extra) y `control-import.service.ts`
(`persistControlObra`, persistencia del control financiero).

> Flujo en la web: **crear la obra primero** (botón "Nueva obra" → form manual con nombre/código/
> estado/fecha/centro de costo) y **después importar el Resumen** apuntando a esa obra (`obraId`).
> El import respeta el nombre/código que puso el usuario y solo enriquece el resto. Si no se pasa
> `obraId`, la obra se crea/actualiza derivando el código del nombre de archivo (compatibilidad).
>
> El importador viejo del **APU_Unificado** (`apu-import.service.ts`) fue eliminado, junto con sus
> scripts (`seed-apu`, `verify-apu`, `validate-parser`, `inject-aprobado`). El historial vive en git.

Hojas que consume:

| Hoja | → DB | Descripción |
|------|------|-------------|
| `0_CONFIG` | `Obra` + `PresupuestoHeader` | nombre, estado, **Valor CAC base** → `cacValor`, **Mes base CAC**, **K** → `coefGGBB`, fecha inicio, costo controlable, PV total, % blanco/negro, centro de costo |
| `0_Indice_CAC` | `IndiceICC` + `IndiceCAC` | Serie mensual del ICC (valores absolutos reales INDEC). Omite proyecciones y meses futuros |
| `0_Jornales_MO` | `TarifaUOCRA` | Tarifas de jornal por categoría y mes |
| `1_Composicion` | `Insumo` + `Partida` + `Composicion` | Deriva insumos (dedup por código) y partidas. Col 17 `Cod_Item_Ppto` linkea cada partida con su ítem de presupuesto |
| `1_Presupuesto` | `LineaPresupuesto` | Tareas con costos (MT/MO-OTR/MO-ALB/EQ por ud + rubros granulares + % certificado), CD/ud y **precio de venta unitario real** (col 15) |
| `_Listas` | `RubroContable` | Catálogo de cuentas contables (linkea movimientos por código) |
| `2_Movimientos` | `Movimiento` | Asientos contables (debe/haber) linkeados a rubro y subcontrato |
| `2_Subcontratos` | `SubcontratoObra` | Subcontratos con monto, pagado y saldo |
| `2_Quincenas` | `Quincena` | Horas y costo de MO por quincena |
| `2_Gastos_DirInd` | `GastoDirInd` | Gastos directos/indirectos |
| `Cert_OC_Cliente` / `Cert_Cabecera` / `Cert_App_Output` | `ContratoCliente` + `Certificacion` + `CertificacionLinea` | Contratos del cliente y certificaciones emitidas |

Estas tablas de "control financiero" alimentan la vista `/obras/:id/control` (KPIs: desvío por
rubro, margen, flujo de caja, certificación). Se borran y recrean por obra en cada import
(idempotente); los catálogos globales (`RubroContable`, `IndiceCAC`, `TarifaUOCRA`) se upsertean.

Detalles clave:
- **Código de obra** (cuando NO se pasa `obraId`) se deriva del nombre de archivo
  (`CH_2171_Resumen…` → `CH2171`) para no duplicar obras existentes.
- Crea **un** `PresupuestoHeader` (tipo `APROBADO`, `estado=vigente`) y reemplaza todos los headers
  previos de la obra (import idempotente). Las vistas eligen header por `estado=vigente` + más
  reciente, no por tipo.
- El **ICC** se pobla solo desde `0_Indice_CAC` → el coeficiente de actualización
  (`coef = ICC_actual / cacValor`) se calcula sin carga manual.
- **Cronograma mensual: pendiente.** `parseCronograma` ya detecta columnas de meses (header con
  fecha o `YYYY-MM`) en `1_Presupuesto` y arma las `LineaCronograma`; cuando Arquinering agregue
  esas columnas se llena solo. Hasta entonces el cronograma queda vacío y **la Proyección de
  insumos se ve vacía** (distribuye insumos mes a mes según el cronograma).

**Dry-run desde script:**
```bash
cd backend && npx tsx scripts/test-import-dry.ts [ruta-al-resumen.xlsx]
```

---

## API — Endpoints principales

```
POST   /api/auth/login
GET    /api/obras
POST   /api/obras
GET    /api/obras/:id
GET    /api/partidas
GET    /api/partidas/:id
GET    /api/insumos
GET    /api/presupuestos
POST   /api/presupuestos
GET    /api/planificacion
POST   /api/planificacion
GET    /api/dashboard
GET    /api/health         ← health check con ping a DB
```

Todos los endpoints excepto `/api/auth/*` y `/api/health` requieren `Authorization: Bearer <jwt>`.

---

## Variables de entorno

### Backend (`backend/.env`)
```env
DATABASE_URL=          # Supabase pooler puerto 6543 (pgbouncer=true)
DIRECT_DATABASE_URL=   # Supabase direct puerto 5432 (para migraciones)
JWT_SECRET=            # Generar: python3 -c "import secrets; print(secrets.token_hex(32))"
CORS_ORIGIN=           # URL del frontend en Vercel (ej: https://brickly.vercel.app)
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=        # Google AI Studio — opcional, habilita el clasificador de categorías de insumos
GEMINI_MODEL=          # opcional, default gemini-2.0-flash
```

### Frontend (Vercel dashboard)
```env
VITE_API_URL=          # URL del backend en Railway (ej: https://brickly-backend.up.railway.app)
```

> ⚠️ `backend/.env.supabase` y `backend/.env` están en `.gitignore`. Nunca commitear credenciales.

---

## Deploy

| Servicio | Plataforma | Trigger |
|----------|-----------|---------|
| Frontend | Vercel | Auto-deploy en push a `main` |
| Backend | Railway | Auto-deploy en push a `main` (root dir: `backend/`) |
| DB | Supabase | Manual |

**Railway:** usar root directory `backend/`. Nixpacks detecta el Dockerfile automáticamente.

`npm run start` en el backend corre `prisma migrate deploy` antes de levantar el servidor — las migraciones se aplican automáticamente en cada deploy.

---

## Desarrollo local

```bash
# Levantar DB local
docker compose up -d

# Backend (puerto 3000)
cd backend
cp .env.docker .env   # o .env.supabase para usar prod DB
npm install
npm run dev

# Frontend (puerto 5173)
cd frontend
npm install
npm run dev
```

El frontend en dev hace proxy de `/api/*` → `http://localhost:3000` (configurado en `vite.config.ts`).

---

## Convenciones de código

- **TypeScript estricto** en ambos lados
- **Prisma** para todo acceso a DB — sin queries SQL raw salvo casos especiales
- **Upsert por código** al importar insumos y partidas (campo `codigo` es `@unique`)
- Los precios en DB son `Decimal` con 2 decimales — no usar `float` para dinero
- **Precio de venta y coeficiente GGBB (K):** usar siempre `backend/src/lib/pricing.ts`
  (`precioVentaUnitario` / `coefGGBB`). NUNCA hardcodear el factor K — vive por presupuesto en
  `PresupuestoHeader.coefGGBB` y, congelado, en `LineaPresupuesto.precioVenta`.
- El campo `Insumo.embedding` existe en el schema pero está **sin uso** (ver Features de IA)
- Fechas en ISO 8601, zona horaria del servidor

---

## Features de IA (Gemini)

> **Estado (2026-05-31): IA viva acotada — clasificador de categorías de insumos.**
> El único uso de IA en el backend es el **clasificador de categorías** (`services/ai/`:
> `gemini.client.ts` + `categorizer.ts`). Corre en **write-time** (al importar una obra, y vía
> backfill), nunca en el hot-path por request:
>
> - Al importar (`resumen-import.service.ts`), después del upsert de insumos, Gemini lee
>   descripción+tipo de cada insumo **sin `categoriaCanonica`** y le asigna una categoría canónica
>   (Corralón, Acero, Eléctricos, UOCRA, etc.). Se persiste en `Insumo.categoriaCanonica` +
>   `fuenteCategoria='ia'`. El bulk-upsert NO pisa `categoriaCanonica`, así que re-importar no
>   recategoriza lo ya resuelto. Es **best-effort**: si Gemini falla o no hay key, el import sigue.
> - Backfill / recategorizar: `POST /api/insumos/categorizar` (`?todos=true` para rehacer todo).
> - La vista "Proyección de insumos" agrupa por `categoriaCanonica ?? categoria ?? "Sin categoría"`.
>
> Requiere `GEMINI_API_KEY` (Google AI Studio). Sin la key, todo funciona pero no se categoriza.
> Modelo configurable con `GEMINI_MODEL` (default `gemini-2.0-flash`).
>
> El resto del código IA histórico (embeddings, LLM genérico, deduplicador) sigue **eliminado**.
> No reintroducir Gemini en el hot-path por request: la IA va en write-time/offline.

---

## Estado actual del proyecto

- ✅ Auth, obras, partidas, insumos, presupuestos, planificación
- ✅ Dashboard con métricas de obra
- ✅ Sidebar de navegación
- ✅ Librería UI completa (Button, Card, Dialog, Badge, Tabs, etc.)
- ✅ Importador del Resumen de Obra (presupuesto + composición + ICC automático)
- ✅ Pantalla de importación en la UI
- ✅ Coeficiente de actualización ICC (Dashboard, presupuestos, obra)
- ✅ Reporte de avance real de obra (mobile/web): `/avance`, modelo `AvanceReporte`, real vs previsto
- ✅ Certificación de avance (web, pestaña "Certificaciones" en la obra): arma la certificación del
  mes desde el avance reportado, a **precio de venta**, con desacopio → **subtotal a enviar al
  cliente**. Reusa `Certificacion`/`CertificacionLinea`/`ContratoCliente` con `fuente='app'` (el
  import solo borra `fuente='import'`). Ciclo de vida `estado`:
  `borrador → enviada → conformada → valorizada → facturada → cobrada` (transiciones validadas en
  `obras.routes.ts`). Endpoints: `GET/POST/DELETE` por cert, `GET …/preview?mes=&anio=`,
  `PATCH …/:certId` (estado), `GET …/:certId/valorizacion` + `POST …/:certId/valorizar`.
  - ✅ **Certificación formal (`valorizada`)**: sobre el subtotal conformado, redeterminación
    **CAC** (ratio = índice fecha / índice base, desde `IndiceCAC`) → desdoblamiento
    **facturable / no facturable** (% sobre el total, negociable, NO por tarea) → **IVA** solo sobre
    el facturable. Los inputs (pctFacturable, pctIva, indiceCacBase, indiceCacFecha) se persisten en
    `Certificacion`; el desglose se computa con ellos (`computarValorizacion`). Defaults sugeridos
    del OC importado. Referencia: `ESPEC_Circuito_Certificacion_v8.md` del repo de migración.
  - 🔄 Pendiente: factura del componente facturable y registro de cobranza (estados
    `facturada`/`cobrada` ya existen en la máquina, falta UI/modelo de comprobantes).
- ✅ Layout responsive (sidebar drawer en mobile, presupuesto legible en celular)
- 🔄 Cronograma mensual desde `1_Presupuesto` (pendiente: faltan columnas de meses en el Excel) → habilita la Proyección de insumos
