---
name: test-ui
description: Drive the local Brickly frontend with headless Playwright to verify a UI behavior. Use when the user says "/test-ui ..." or asks you to manually test/reproduce something in the running app. Logs in, performs the requested flow, returns a screenshot + console/network errors so you can diagnose without the user describing it manually.
---

# /test-ui — local UI testing via headless Playwright

This skill writes a one-off Playwright script tailored to the user's instruction, runs it headless against the local dev servers, captures a screenshot + logs, and reports findings.

## Preconditions — check and fix ALL THREE services before running

Call `ensureServices()` at the top of every test script (see template). It automatically:

1. **Frontend** (`http://localhost:5173`) — if down, spawns `npm run dev` in `frontend/` and waits up to 60s
2. **Backend** (`http://localhost:3000`) — checks `/api/health`; if down, starts the Docker DB container first, then spawns `npm run dev` in `backend/` and waits up to 60s
3. **Database** — read from `/api/health` response (`db: "connected"`); if unreachable, runs `docker compose up -d` from the repo root and waits for port 5434 to accept connections

If any service fails to come up within its timeout, `ensureServices()` throws with a clear message — the script will exit and report the failure. Do NOT manually curl/check before running; let `ensureServices()` handle it.

## How to run a test

1. **Read the user's instruction carefully.** Identify: which page to land on, which interactions to perform, what assertion to make.
2. **Write a script** at `/tmp/test-ui/run.mjs` that imports from the helpers module. Always call `ensureServices()` first, then use helpers for login/upload.
3. **Run it** with `node /tmp/test-ui/run.mjs`. Timeout: 90s (services may need to start).
4. **Read the screenshot** at `/tmp/test-ui/<name>.png` with the Read tool and inspect logs at `/tmp/test-ui/<name>.log.json`.
5. **Report** to the user: pass/fail + what the screenshot shows + any console/network errors.

## Helpers available

Import from `/Users/pablopagliaricci/brickly/.claude/skills/test-ui/helpers.mjs`:

- `ensureServices()` — **call first in every script**. Checks frontend + backend + DB; starts any that are down. Throws if a service can't be brought up.
- `launch({ headless })` → `{ browser, context, page, logs }` (logs collects console + network 4xx/5xx + page errors)
- `login(page, email?, password?)` — defaults: `arquinering@gmail.com` / `arquinering`
- `uploadXlsx(page, filePath?)` — defaults to `/Users/pablopagliaricci/Downloads/APU_Unificado_GDR3760_VF.xlsx`
- `snapshot(page, name, logs)` — screenshot + logs to `/tmp/test-ui/`
- `finish(browser, page, logs, name)` — snapshot then close browser
- Constants: `FRONTEND_URL`, `BACKEND_URL`, `SAMPLE_XLSX`

## Script template

```js
import { ensureServices, launch, login, uploadXlsx, finish, FRONTEND_URL } from "/Users/pablopagliaricci/brickly/.claude/skills/test-ui/helpers.mjs";

// Always ensure services are healthy before anything else
await ensureServices();

const { browser, page, logs } = await launch();
try {
  await login(page);

  // === custom steps for THIS test go here ===
  // e.g. await uploadXlsx(page);
  // await page.goto(`${FRONTEND_URL}/presupuesto`);
  // await page.waitForLoadState("networkidle");
  // const total = await page.locator('[data-testid="total"]').textContent();
  // logs.assertions = { total };

  await finish(browser, page, logs, "final");
} catch (err) {
  logs.error = String(err);
  await finish(browser, page, logs, "error");
  process.exit(1);
}
```

## Notes

- Always run **headless**. Don't open a visible browser unless the user asks.
- Keep scripts minimal — one flow per script. If the user requests two unrelated checks, make two scripts.
- If a selector is uncertain, grep the relevant page component in `frontend/src/pages/` first to find a stable selector (test-id, role, text). Avoid brittle CSS class chains.
- Don't assert on exact pixel positions. Assert on text content, element presence, or screenshot review.
- For SPA route changes, prefer `page.goto(FRONTEND_URL + "/route")` over clicking nav links unless the nav itself is what you're testing.
- The screenshot is your primary diagnostic — always Read it after running.
- If `ensureServices()` throws "revisá Docker Desktop", tell the user Docker Desktop isn't running and ask them to start it.
