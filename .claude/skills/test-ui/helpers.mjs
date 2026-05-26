// Reusable helpers for /test-ui scripts. Import from your generated script.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

export const OUT_DIR = "/tmp/test-ui";
mkdirSync(OUT_DIR, { recursive: true });

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
export const DEFAULT_EMAIL = "arquinering@gmail.com";
export const DEFAULT_PASSWORD = "arquinering";
export const SAMPLE_XLSX = "/Users/pablopagliaricci/Downloads/APU_Unificado_GDR3760_VF.xlsx";
const REPO_ROOT = resolve("/Users/pablopagliaricci/brickly");

// ─── Service health & auto-start ──────────────────────────────────────────────

async function isReachable(url, timeoutMs = 3000) {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(id);
    let body = null;
    try { body = await r.json(); } catch {}
    return { ok: true, status: r.status, body };
  } catch {
    return { ok: false };
  }
}

async function waitUntil(checkFn, { intervalMs = 2000, timeoutMs = 60000, label = "service" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkFn()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
    process.stdout.write(`  ⏳ esperando ${label}…\n`);
  }
  return false;
}

async function ensureDb() {
  process.stdout.write("🐳 Levantando contenedor de base de datos (docker compose up -d)…\n");
  const child = spawn("docker", ["compose", "up", "-d"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  await new Promise((res) => child.on("close", res));
  // Wait for postgres port 5434 to accept connections (up to 30s)
  const ready = await waitUntil(
    async () => {
      try {
        const { createConnection } = await import("node:net");
        return await new Promise((res) => {
          const sock = createConnection({ host: "localhost", port: 5434 });
          sock.on("connect", () => { sock.destroy(); res(true); });
          sock.on("error", () => res(false));
          setTimeout(() => { sock.destroy(); res(false); }, 1000);
        });
      } catch { return false; }
    },
    { timeoutMs: 30000, label: "postgres:5434" }
  );
  if (!ready) throw new Error("Postgres no respondió en 30s — revisá Docker Desktop");
}

async function ensureBackend() {
  process.stdout.write("🚀 Iniciando backend (npm run dev)…\n");
  spawn("npm", ["run", "dev"], {
    cwd: resolve(REPO_ROOT, "backend"),
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  }).unref();
  const ready = await waitUntil(
    async () => {
      const r = await isReachable(`${BACKEND_URL}/api/health`);
      return r.ok && r.body?.db === "connected";
    },
    { timeoutMs: 60000, label: "backend + db" }
  );
  if (!ready) throw new Error("Backend no levantó en 60s — revisá logs en backend/");
}

async function ensureFrontend() {
  process.stdout.write("🌐 Iniciando frontend (npm run dev)…\n");
  spawn("npm", ["run", "dev"], {
    cwd: resolve(REPO_ROOT, "frontend"),
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  }).unref();
  const ready = await waitUntil(
    async () => (await isReachable(FRONTEND_URL)).ok,
    { timeoutMs: 60000, label: "frontend" }
  );
  if (!ready) throw new Error("Frontend no levantó en 60s — revisá logs en frontend/");
}

/**
 * Verifica que frontend, backend y DB estén sanos.
 * Si alguno falla, intenta levantarlo automáticamente.
 * Debe llamarse al inicio de cada script de test.
 */
export async function ensureServices() {
  process.stdout.write("🔍 Verificando servicios…\n");

  // ── Backend + DB ──────────────────────────────────────────────────────────
  const health = await isReachable(`${BACKEND_URL}/api/health`);

  if (!health.ok) {
    // Backend caído: primero levantamos DB, luego backend
    await ensureDb();
    await ensureBackend();
  } else if (health.body?.db !== "connected") {
    // Backend up pero DB caída
    process.stdout.write("⚠ Backend activo pero DB no conectada — levantando DB…\n");
    await ensureDb();
    // Esperar a que el backend se reconecte (cada health request intenta $queryRaw)
    const dbReady = await waitUntil(
      async () => {
        const r = await isReachable(`${BACKEND_URL}/api/health`);
        return r.ok && r.body?.db === "connected";
      },
      { timeoutMs: 30000, label: "reconexión DB" }
    );
    if (!dbReady) throw new Error("DB levantó pero el backend no reconectó — reiniciá el backend manualmente");
  }

  // ── Frontend ──────────────────────────────────────────────────────────────
  const fe = await isReachable(FRONTEND_URL);
  if (!fe.ok) await ensureFrontend();

  // ── Reporte final ──────────────────────────────────────────────────────────
  const finalHealth = await isReachable(`${BACKEND_URL}/api/health`);
  process.stdout.write(
    `✅ Servicios OK — frontend: ${FRONTEND_URL} | backend: ${BACKEND_URL} | db: ${finalHealth.body?.db ?? "?"}\n`
  );
}

export async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  return { browser, context, page, logs: { consoleLogs, networkErrors, pageErrors } };
}

export async function login(page, email = DEFAULT_EMAIL, password = DEFAULT_PASSWORD) {
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("login") && url.pathname !== "/", { timeout: 15000 }).catch(() => {}),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

export async function uploadXlsx(page, filePath = SAMPLE_XLSX) {
  // Navigate to import page (adjust route if needed)
  await page.goto(`${FRONTEND_URL}/import`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
}

export async function snapshot(page, name, logs) {
  const shotPath = join(OUT_DIR, `${name}.png`);
  const logsPath = join(OUT_DIR, `${name}.log.json`);
  await page.screenshot({ path: shotPath, fullPage: true });
  writeFileSync(logsPath, JSON.stringify(logs, null, 2));
  return { shotPath, logsPath };
}

export async function finish(browser, page, logs, name = "final") {
  const out = await snapshot(page, name, logs);
  await browser.close();
  return out;
}
