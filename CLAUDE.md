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
│   ├── scripts/       # seed-apu.ts, verify-apu.ts, create-user.ts
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

## Importación de datos — APU Unificado

El formato de Excel principal es **APU_Unificado** (formato GDR). Tiene estas hojas clave:

| Hoja | → DB | Descripción |
|------|------|-------------|
| `MATERIALES` | `Insumo` (MATERIAL) | Catálogo de materiales con precio y proveedor |
| `MANO_DE_OBRA` | `Insumo` (MANO_DE_OBRA) | Jornales con cargas sociales |
| `EQUIPOS` | `Insumo` (EQUIPO) | Costo por día de equipos |
| `SUBCONTRATOS` | `Insumo` (SUBCONTRATO) | Precios de subcontratistas |
| `PARTIDAS` | `Partida` | 269 APUs con código, rubro, unidad, rendimiento |
| `COMPOSICIÓN` | `Composicion` | 1846 filas: partida × insumo × cantidad |

**Script de verificación antes de importar:**
```bash
cd backend && npx tsx scripts/verify-apu.ts [ruta-al-xlsx]
```

**Script de seed:**
```bash
cd backend && npm run seed:apu
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
GEMINI_API_KEY=        # Google AI Studio — opcional, habilita embeddings y validación IA
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
- Embeddings de Gemini en `Insumo.embedding` (768 dims) para detección de duplicados semánticos
- Fechas en ISO 8601, zona horaria del servidor

---

## Features de IA (Gemini)

- **Embeddings semánticos** en insumos: detecta duplicados aunque tengan descripciones distintas
- **LLM validation**: puede analizar partidas y composiciones antes de importar
- Si `GEMINI_API_KEY` está vacío, el sistema funciona sin IA (features deshabilitadas gracefully)

---

## Estado actual del proyecto

- ✅ Auth, obras, partidas, insumos, presupuestos, planificación
- ✅ Dashboard con métricas de obra
- ✅ Sidebar de navegación
- ✅ Librería UI completa (Button, Card, Dialog, Badge, Tabs, etc.)
- 🔄 Importador APU Unificado (pendiente — script de verificación listo)
- 🔄 Pantalla de importación en la UI
