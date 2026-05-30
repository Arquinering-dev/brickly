---
name: check-deploy
description: Verifica que el deploy de producción esté sano — Supabase (DB), backend en Railway y frontend en Vercel, más un chequeo end-to-end de auth+datos. Usar cuando el usuario diga "/check-deploy", pida confirmar que prod está andando, que el deploy salió bien, o que Supabase/Railway/Vercel están saludables. Pide las URLs/credenciales que necesita en el momento (no las guarda). Solo lectura — no modifica nada.
---

# /check-deploy — health check de producción (Supabase + Railway + Vercel)

Confirma que los tres servicios estén arriba y bien conectados entre sí. Solo hace requests HTTP de
lectura + un login de prueba. **No modifica nada.**

Qué verifica:
1. **Railway (backend)** responde — `GET <backend>/api/health` HTTP 200.
2. **Supabase (DB)** conectada — el mismo `/api/health` hace ping a la DB (`db: "connected"`).
3. **Vercel (frontend)** sirve la app — `GET <frontend>/` 200 + HTML de la SPA.
4. **CORS** — el backend permite el origen del frontend (si no, el front no puede llamar a la API).
5. **End-to-end (opcional, con login)** — login real → token → `GET /api/obras` (auth + datos) →
   `GET /api/dashboard` (confirma que el deploy tiene el código/schema actual).

## Credenciales — pedilas en el momento, no las guardes

Este skill **no tiene** las URLs ni las credenciales. Antes de correr, **pedíselas al usuario** una
por una, a medida que las necesites, y usalas solo en memoria (no las escribas a ningún archivo):

- **URL del backend (Railway)** — requerida. Ej: `https://brickly-backend.up.railway.app`.
- **URL del frontend (Vercel)** — para los checks 3 y 4. Ej: `https://brickly.vercel.app`.
- **Email + contraseña de un usuario de prod** — opcional, habilita el end-to-end (4–5). Si el
  usuario prefiere no pasar la contraseña por el chat, ofrecele correr el comando él mismo con `!`.

Si más adelante se quiere chequear el estado del deploy a nivel plataforma (no solo HTTP), ahí sí
pediría tokens de Railway/Vercel — pero para "¿está andando?" alcanza con las URLs públicas.

## Cómo correr

Una vez que tengas las URLs (y opcionalmente el login), corré el helper pasando todo por env:
```bash
BACKEND_URL="https://…railway.app" \
FRONTEND_URL="https://…vercel.app" \
LOGIN_EMAIL="…" LOGIN_PASSWORD="…" \
node /Users/pablopagliaricci/brickly/.claude/skills/check-deploy/check-deploy.mjs
```
(BACKEND_URL es lo único obligatorio. Omití LOGIN_* para saltar el end-to-end.)

> Si el entorno donde corre Claude no tiene salida a internet, el script va a fallar con error de
> red. En ese caso, pedile al usuario que lo corra él mismo con `! BACKEND_URL=… node …` (el prefijo
> `!` ejecuta en su sesión) y que pegue la salida.

## Cómo interpretar / reportar

- Cada línea es `✓`/`✗` con detalle. Al final: `✅ TODO OK` o `⚠ N checks fallaron`.
- Si **Supabase** falla pero el backend responde → la DB está caída o `DATABASE_URL` mal en Railway.
- Si **CORS** falla → `CORS_ORIGIN` en Railway no coincide con la URL real de Vercel.
- Si **login** falla con 401 → no existe ese usuario en la DB de prod (¿la sembraste?).
- Si `/api/obras` da 0 obras → la DB está vacía (todavía no importaste los APU Unificados).
- Si un endpoint nuevo (p.ej. `/api/dashboard`) da 404 → Railway está sirviendo una versión vieja
  (el deploy no tomó el último push / no corrió `prisma migrate deploy`).

## Inicialización desde cero (fuera de este skill)

El skill solo **verifica**; no toca datos. Para arrancar limpio:
1. **Limpiar la DB de Supabase** (volumes limpios) — paso manual del usuario (Supabase SQL editor /
   reset, o `prisma migrate reset` apuntando a la DB de prod). Es destructivo: lo hace el usuario.
2. El usuario **importa los APU Unificados finales** de ambas obras desde la web (`/catalogo/importar`):
   `APU_Unificado_GDR3760_VF_conAprobado.xlsx` y `APU_Unificado_CH2171_v4_4_conAprobado.xlsx`.
3. Correr `/check-deploy` con login → debería mostrar las 2 obras y todo ✓.
