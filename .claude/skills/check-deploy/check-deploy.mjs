/**
 * check-deploy.mjs — Health check de PRODUCCIÓN (Supabase + Railway + Vercel). Sin dependencias.
 * Inputs por variable de entorno (los provee el usuario en el momento; no se guardan):
 *   BACKEND_URL   (Railway)   — requerido
 *   FRONTEND_URL  (Vercel)    — opcional
 *   LOGIN_EMAIL / LOGIN_PASSWORD — opcional (habilita el chequeo end-to-end de auth + datos)
 *
 * Uso: BACKEND_URL=https://… FRONTEND_URL=https://… node check-deploy.mjs
 * Solo hace requests HTTP de lectura + un login de prueba. No modifica nada.
 */
const BACKEND = process.env.BACKEND_URL?.replace(/\/+$/, "");
const FRONTEND = process.env.FRONTEND_URL?.replace(/\/+$/, "");
const EMAIL = process.env.LOGIN_EMAIL, PASS = process.env.LOGIN_PASSWORD;
const TIMEOUT = 20000;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function tryFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });
    return { res, status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

if (!BACKEND) { console.error("Falta BACKEND_URL (la URL del backend en Railway)."); process.exit(2); }

console.log("VERIFICACIÓN DE DEPLOY — producción (solo lectura)\n");

// 1) Backend (Railway) + 2) Supabase (el health hace ping a la DB)
console.log("Railway (backend) + Supabase (DB):");
{
  const r = await tryFetch(`${BACKEND}/api/health`);
  if (r.error) { check("Backend responde", false, r.error); check("Supabase DB conectada", false, "no se pudo consultar /api/health"); }
  else {
    const j = await r.res.json().catch(() => ({}));
    check("Backend responde (Railway)", r.status === 200 && j.status === "ok", `HTTP ${r.status}, status=${j.status}`);
    check("Supabase DB conectada", j.db === "connected", `db=${j.db}${j.latencyMs != null ? `, ping ${j.latencyMs}ms` : ""}`);
  }
}

// 3) Frontend (Vercel)
if (FRONTEND) {
  console.log("\nVercel (frontend):");
  const r = await tryFetch(FRONTEND);
  if (r.error) check("Frontend sirve la app", false, r.error);
  else {
    const html = await r.res.text().catch(() => "");
    check("Frontend sirve la app (Vercel)", r.status === 200 && /<div id="root"|<title|vite/i.test(html), `HTTP ${r.status}`);
  }
  // CORS: ¿el backend permite el origen del frontend?
  const c = await tryFetch(`${BACKEND}/api/health`, { headers: { Origin: FRONTEND } });
  if (!c.error) {
    const acao = c.res.headers.get("access-control-allow-origin");
    check("CORS backend ↔ frontend", acao === FRONTEND || acao === "*", `Access-Control-Allow-Origin=${acao ?? "(ausente)"}`);
  }
}

// 4) End-to-end con auth (opcional) — vía TOKEN provisto a mano o LOGIN_EMAIL/PASSWORD
const TOKEN_ENV = process.env.TOKEN;
if (TOKEN_ENV || (EMAIL && PASS)) {
  console.log("\nEnd-to-end (auth + datos):");
  let token = TOKEN_ENV ?? null;
  if (token) {
    check("Token provisto (auth a mano)", true, "se usa el TOKEN pasado por el usuario");
  } else {
    const login = await tryFetch(`${BACKEND}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    if (login.error) check("Login", false, login.error);
    else { const j = await login.res.json().catch(() => ({})); token = j.token; check("Login (auth + tabla usuarios)", login.status === 200 && !!token, `HTTP ${login.status}`); }
  }
  if (token) {
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const obras = await tryFetch(`${BACKEND}/api/obras`, auth);
    if (!obras.error) { const j = await obras.res.json().catch(() => []); check("API autenticada + datos", obras.status === 200, `GET /api/obras → ${Array.isArray(j) ? j.length : 0} obras ${Array.isArray(j) ? JSON.stringify(j.map((o) => o.codigo)) : ""}`); }
    else check("API autenticada + datos", false, obras.error);
    // Endpoint nuevo (confirma que el deploy tiene el código/schema actual)
    const dash = await tryFetch(`${BACKEND}/api/dashboard`, auth);
    if (!dash.error) check("Endpoint /api/dashboard (deploy actual)", dash.status === 200, `HTTP ${dash.status}`);
  }
} else {
  console.log("\n(End-to-end de auth omitido — pasá TOKEN, o LOGIN_EMAIL y LOGIN_PASSWORD, para incluirlo.)");
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? "✅ TODO OK" : `⚠ ${failed} de ${results.length} checks fallaron`} — ${results.length} verificaciones`);
process.exit(failed === 0 ? 0 : 1);
