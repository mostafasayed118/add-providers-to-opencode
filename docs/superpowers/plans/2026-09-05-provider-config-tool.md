# Provider Config Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-ready Next.js + Electron form that validates base_url/api_key/model_id and writes global opencode config.

**Architecture:** Next.js App Router UI posts to Node API routes; `src/lib/opencode-config.ts` owns path resolution, zod validation, backup + atomic write; Electron shell wraps `next start` for desktop use.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS 3, zod 3, Electron 30, electron-builder, node:test for unit tests

**Spec:** `docs/superpowers/specs/2026-09-05-provider-config-tool-design.md`

## Global Constraints

- Config target is global `~/.config/opencode/opencode.json` (Windows `%USERPROFILE%\.config\opencode\opencode.json`), resolved via `os.homedir()`
- Provider choice is explicit radio `openai-compatible | custom`, custom requires lowercase slug providerId default `custom`
- Secrets never logged, never returned by GET, atomic write via tmp + rename with timestamped backup
- `npm run build` must pass with zero TypeScript errors
- Responsive layout max-w-xl card, labels for all inputs, aria-invalid on errors

---

### Task 1: Scaffold Next.js + deps + base configs

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `.gitignore`, `.nvmrc`, `.env.example`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: none
- Produces: `npm run dev/build/start/lint` scripts; Tailwind globals available to Task 4

- [ ] **Step 1: Write the failing smoke test**

```js
// scripts/smoke.mjs
import { existsSync } from "node:fs";
const required = ["package.json","tsconfig.json","next.config.mjs","src/app/layout.tsx"];
const missing = required.filter((f) => !existsSync(new URL(`../${f}`, import.meta.url)));
if (missing.length) { console.error("missing: " + missing.join(", ")); process.exit(1); }
console.log("smoke ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/smoke.mjs`
Expected: FAIL with "missing: package.json, ..."

- [ ] **Step 3: Write minimal scaffold**

`package.json` (exact):
```json
{
  "name": "opencode-provider-config-tool",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "electron:dev": "electron electron/main.js",
    "dist": "next build && electron-builder"
  },
  "dependencies": { "next": "14.2.5", "react": "18.3.1", "react-dom": "18.3.1", "zod": "3.23.8" },
  "devDependencies": { "@types/node": "20.14.0", "@types/react": "18.3.3", "autoprefixer": "10.4.19", "electron": "30.0.0", "electron-builder": "24.13.3", "postcss": "8.4.39", "tailwindcss": "3.4.4", "typescript": "5.4.5" }
}
```
Plus standard `tsconfig.json` (strict), `next.config.mjs` (`reactStrictMode: true`), Tailwind + PostCSS defaults, `src/app/layout.tsx` with metadata, `src/app/globals.css` with `@tailwind base; @tailwind components; @tailwind utilities;`, `.nvmrc` (`20`), `.env.example` (`# no secrets required\nPORT=3000`), `.gitignore` (node_modules, .next, out, dist, *.bak.*).

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/smoke.mjs`
Expected: PASS "smoke ok"

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs src/app/layout.tsx src/app/globals.css scripts/smoke.mjs .gitignore .nvmrc .env.example
git commit -m "feat: scaffold next.js app shell"
```

### Task 2: Config lib with validation + atomic write

**Files:**
- Create: `src/lib/opencode-config.ts`
- Test: `tests/opencode-config.test.mjs` (runs via `node --test`)

**Interfaces:**
- Consumes: `os.homedir()` for path
- Produces: `getGlobalConfigPath() => string`, `providerSchema` (zod), `readExistingConfig(path)`, `buildProviderBlock(input)`, `saveProviderConfig(input) => { path, model, backup }` used by Task 3

- [ ] **Step 1: Write the failing test**

```js
// tests/opencode-config.test.mjs (excerpt — full file in task)
import test from "node:test";
import assert from "node:assert/strict";
test("rejects bad url", async () => {
  const { validateInput } = await import("../src/lib/opencode-config.ts");
});
```

> Note: executor writes full test file with tsx transpile via `npx tsx` OR compiles lib to mjs first; simplest: test the compiled validation regexes + merge logic via plain mjs mirror. Keep test command `node --test tests/`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL "Cannot find module .../opencode-config.ts"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/opencode-config.ts (key excerpts — full file required)
import { z } from "zod";
import os from "node:os";
import path from "node:path";
export const providerSchema = z.object({
  base_url: z.string().url().max(2048).refine((u) => {/* https or localhost */ return true; }),
  api_key: z.string().trim().min(8).max(4096),
  model_id: z.string().trim().regex(/^[A-Za-z0-9._:/-]{1,128}$/),
  providerType: z.enum(["openai-compatible", "custom"]),
  providerId: z.string().regex(/^[a-z0-9-]{1,32}$/).default("custom"),
});
export function getGlobalConfigPath() {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}
// + readExistingConfig (tolerate ENOENT, throw on corrupt with .corrupt backup),
// + buildProviderBlock (npm @ai-sdk/openai-compatible),
// + saveProviderConfig (mkdir -p, backup, tmp+rename, read-back verify)
```

Executor must implement localhost-https rule, trailing-slash strip, and redacted logging exactly per spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: PASS (all validation + merge + backup tests green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/opencode-config.ts tests/opencode-config.test.mjs
git commit -m "feat: opencode config lib with validation and atomic write"
```

### Task 3: API routes save + current

**Files:**
- Create: `src/app/api/save-provider/route.ts`, `src/app/api/current-config/route.ts`
- Test: manual `curl` + `npm run build`

**Interfaces:**
- Consumes: Task 2 `saveProviderConfig`, `getGlobalConfigPath`
- Produces: `POST /api/save-provider` → `{ ok, path, model, backup } | { ok:false, errors }`; `GET /api/current-config` → `{ path, model, providerId, exists }` (no secrets)

- [ ] **Step 1: Write the failing check**

Run: `npm run build`
Expected: FAIL (routes missing → page has no action)

- [ ] **Step 2: Write minimal routes**

`save-provider/route.ts`: `await req.json()` → `providerSchema.safeParse` → 400 `{ ok:false, errors: fieldErrors }` on fail → `saveProviderConfig` → 200; catch EACCES → 500 clear message; never log api_key.
`current-config/route.ts`: read file if exists, parse `model`, redact; return exists flag.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS with `/api/save-provider` and `/api/current-config` compiled

- [ ] **Step 4: Commit**

```bash
git add src/app/api/save-provider/route.ts src/app/api/current-config/route.ts
git commit -m "feat: save and current config api routes"
```

### Task 4: Form UI with validation + responsive layout

**Files:**
- Create: `src/app/page.tsx`
- Modify: `src/app/globals.css` (focus styles if needed)
- Test: `npm run build` + manual submit matrix

**Interfaces:**
- Consumes: Task 3 APIs
- Produces: rendered form; no downstream deps

- [ ] **Step 1: Write failing build check** — `src/app/page.tsx` missing → build succeeds but page is default; assert form fields exist via grep:

Run: `node -e "const f=require('fs').readFileSync('src/app/page.tsx','utf8'); if(!/base_url/.test(f)) throw new Error('no form')"`
Expected: FAIL (file missing)

- [ ] **Step 2: Implement form** — controlled inputs, client validators mirroring zod, providerType radio toggling providerId, password show/hide, inline `<p role=alert>` errors, `aria-invalid`, status machine idle|saving|success|error, success panel with path + model + backup, Reset + Load current buttons, `fetch` POST/GET with JSON, Tailwind max-w-xl card.

- [ ] **Step 3: Verify** — `npm run build` PASS; manual: empty submit → 3 errors; bad URL → 1 error; valid → success panel; responsive at 375px/1280px.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: provider config form ui with validation"
```

### Task 5: Electron shell + packaging + docs

**Files:**
- Create: `electron/main.js`, `electron/preload.js`, `electron-builder.yml`, `README.md`
- Test: `npm run build` + `npx electron --version`

**Interfaces:**
- Consumes: Tasks 1–4 (needs built Next.js)
- Produces: `npm run electron:dev`, `npm run dist` artifacts

- [ ] **Step 1: Failing check** — `node -e "require('fs').accessSync('electron/main.js')"` → FAIL

- [ ] **Step 2: Implement** — `main.js`: app ready → spawn `next start -p 3000` in prod else load `http://localhost:3000`, BrowserWindow 1024x768, contextIsolation, preload exposes `versions` only; `preload.js`: `contextBridge.exposeInMainWorld('versions', ...)`; `electron-builder.yml`: appId `com.opencode.providerconfig`, targets nsis + portable; `README.md`: setup, dev, build, where config is written, validation rules, troubleshooting EACCES/corrupt.

- [ ] **Step 3: Verify** — Run: `npx electron --version` PASS; `npm run build` PASS

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.js electron-builder.yml README.md
git commit -m "feat: electron shell packaging and docs"
```
