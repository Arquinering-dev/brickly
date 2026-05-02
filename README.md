# Brickly — Control de Obra

Sistema interno de gestión de obras para Arquinering S.R.L.  
Importa un APU desde Excel y gestiona partidas, composiciones y presupuesto desde una interfaz web.

---

## Requisitos

- Node.js 20+
- PostgreSQL 14+
- npm 9+

---

## Configuración inicial

### 1. Clonar el repo

```bash
git clone https://github.com/Arquinering-dev/brickly.git
cd brickly
```

### 2. Base de datos

Crear la base de datos en PostgreSQL:

```sql
CREATE DATABASE brickly;
```

### 3. Backend

```bash
cd backend
npm install
```

Crear el archivo `.env`:

```bash
cp .env.example .env
```

Editar `backend/.env` con tu conexión:

```
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/brickly"
NODE_ENV="development"
PORT=3000
```

Ejecutar la migración:

```bash
npm run db:migrate
# cuando pregunte el nombre de la migración escribí: init
```

Iniciar el servidor:

```bash
npm run dev
# corre en http://localhost:3000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# corre en http://localhost:5173
```

---

## Uso

1. Abrí `http://localhost:5173`
2. Ir a **Importar APU** y subir el archivo `.xlsx`
3. Una vez importado, navegar a **Partidas**, **Presupuesto** o **Catálogos**

### Formato esperado del Excel

El archivo debe tener las siguientes hojas:

| Hoja | Contenido |
|------|-----------|
| `CONFIG` | Parámetros: CAC_BASE, COEF_CARGAS_MO, GG, BB |
| `MATERIALES` | Código, Descripción, Unidad, Precio, Proveedor, Categoría |
| `MANO_DE_OBRA` | Código, Descripción, Salario/día, Coef. Cargas, Tipo |
| `EQUIPOS` | Código, Descripción, Costo Total, Vida (días), Costo/día |
| `PARTIDAS` | Código, Rubro, Descripción, Unidad, Rendimiento, Mat Unitario, MO Unitario, EQ Unitario, CD Unitario |
| `COMPOSICIÓN` | Partida Código, Tipo, Insumo Código, Cantidad/Ud, % Desperdicio, Secuencia |
| `PPTO_APROBADO` | Código Partida, Cantidad, MAT Total, MO Total, EQ Total |

---

## API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/apu/import` | Importar Excel (multipart/form-data, campo `file`) |
| GET | `/api/partidas` | Listar partidas (`?rubro=&search=`) |
| GET | `/api/partidas/:id` | Detalle con composición |
| PUT | `/api/partidas/:id` | Editar partida |
| DELETE | `/api/partidas/:id` | Eliminar partida |
| POST | `/api/partidas/:id/composicion` | Agregar insumo |
| PUT | `/api/partidas/:id/composicion/:compId` | Editar insumo |
| DELETE | `/api/partidas/:id/composicion/:compId` | Eliminar insumo |
| GET | `/api/materiales` | Listar materiales (`?search=`) |
| GET | `/api/mano-de-obra` | Listar mano de obra |
| GET | `/api/equipos` | Listar equipos |
| GET | `/api/presupuesto` | Presupuesto agrupado por rubro |

---

## Scripts útiles

```bash
# Backend
npm run dev          # modo desarrollo con hot-reload
npm run db:migrate   # crear/actualizar tablas
npm run db:studio    # abrir Prisma Studio (GUI de la DB)
npm run build        # compilar TypeScript

# Frontend
npm run dev          # modo desarrollo
npm run build        # compilar para producción
```
