# Provider Config Tool — Design Spec (2026-09-05)

## Purpose
Desktop tool with clean form (base_url, api_key, model_id + provider-type choice) that validates
inputs and writes global opencode config so `opencode` picks it up automatically.

## Decisions (user-approved)
- Stack: Option A — Next.js 14 App Router + TypeScript + Tailwind + Electron shell (Recommended)
- Config target: Global `~/.config/opencode/opencode.json`
  (Windows: `%USERPROFILE%\.config\opencode\opencode.json`)
- Provider mapping: user chooses OpenAI-compatible OR custom
- Quality bar: production-ready, structured configs, env vars, dep mgmt, build settings,
  comprehensive error handling, concurrent-safe, end-to-end setup files

## Architecture
- `src/app/` — Next.js UI (form page, layout, globals)
- `src/app/api/save-provider/route.ts` — POST validates (zod), backup + merge + atomic write + verify
- `src/app/api/current-config/route.ts` — GET returns current effective provider/model (secrets redacted)
- `src/lib/opencode-config.ts` — path resolution, read/merge/write, backup, validation schemas
- `electron/main.js` + `electron/preload.js` — BrowserWindow, loads dev `http://localhost:3000`
  or prod `next start`; contextIsolation on, no direct fs from renderer
- `electron-builder.yml` — Windows nsis + portable targets

## Components
- Form card: base_url (url input), api_key (password + show/hide), model_id (text),
  providerType radio (openai-compatible | custom), providerId text (shown when custom,
  default `custom`), Submit / Reset / Load current
- UI states: idle → validating → saving → success | error; inline field errors + form-level
  alert + success panel (written path, effective `model`, backup path)
- Responsive: max-w-xl centered card, mobile stacked, desktop two-col for type + providerId,
  focus rings, aria-invalid/describedby, labels for all inputs

## Data flow
1. User fills fields → client trim + validate (URL, key length, model pattern)
2. POST `/api/save-provider` { base_url, api_key, model_id, providerType, providerId }
3. Server zod validation → resolve global path → mkdir -p → read existing (tolerate ENOENT) →
   backup to `opencode.json.bak.<timestamp>` → merge:
   - openai-compatible: `provider.<id> = { npm: @ai-sdk/openai-compatible, name, options: { baseURL, apiKey } , models: { <model_id>: { name } } }`
   - custom: same shape but `options` passthrough + user providerId, preserve unknown keys
   - top-level `model = "<providerId>/<model_id>"`
4. Atomic write (tmp + rename) → read-back → return { path, model, backup }
5. UI shows success; user runs `opencode` and model is reflected

## Validation rules (client + server, single zod source)
- base_url: valid URL, http(s); `http://` only for localhost/127.0.0.1/*.local/192.168../10./172.16-31.;
  strip trailing `/`, max 2048 chars
- api_key: trim, min 8, max 4096, must not contain whitespace-only; never log full value
- model_id: trim, `^[A-Za-z0-9._:/-]{1,128}$`, no spaces
- providerId (custom): `^[a-z0-9-]{1,32}$` lowercase slug, default `custom`
- providerType: enum `openai-compatible | custom`

## Error handling
- Field errors inline; API errors mapped: EACCES → "permission denied, run as user with home write";
  corrupt JSON → restore hint from `.bak`, keep `.corrupt-<ts>` copy; validation → 400 with field map;
  unexpected → 500 generic + server log (redacted)
- Secrets: never returned by GET, never logged, redacted as `****<last4>` only in success meta if needed
- Concurrency: stateless routes, atomic rename, last-write-wins documented, backup per write

## Testing
- Unit: zod schemas (valid/invalid URLs, keys, model ids)
- Integration: merge preserves unrelated keys, backup created, read-back matches, corrupt recovery
- Manual: `npm run dev` → submit → inspect global JSON → run `opencode` → model reflected;
  `npm run build && npm start`, Electron `npm run electron:dev`

## Setup files (end-to-end, no extra config)
- `package.json` (scripts: dev/build/start/lint/electron:*), `tsconfig.json`, `next.config.mjs`,
  `tailwind.config.ts`, `postcss.config.mjs`, `.env.example`, `.nvmrc`, `.gitignore`,
  `electron-builder.yml`, `README.md`

## Non-goals
- No auto-detect of provider from URL (explicit user choice per request)
- No multi-profile manager / encryption vault in v1 (single active global provider)
- No auto-update; versioned backups instead

## Acceptance
- Empty submit shows 3 field errors; invalid URL shows clear message; valid submit writes global
  JSON, shows path + model, and subsequent `opencode` run reflects it with zero console errors.
