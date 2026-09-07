# User Guide — Opencode Provider Config Tool

> What You'll Learn: add an AI provider to opencode, test it, apply it, and manage it afterwards.
> Prerequisites: opencode installed, a provider account (or local Ollama / LM Studio running), Node 20+ if running from source.
> Time: 5–10 minutes | Level: Beginner (no coding needed)

## 1. What this tool does

Desktop-ready form that writes `base_url`, `api_key`, and `model_id` (+ capabilities) into your opencode config:

- Global: `~/.config/opencode/opencode.json` (Windows: `%USERPROFILE%\.config\opencode\opencode.json`)
- Before every overwrite it makes a timestamped backup (`opencode.json.bak.<ts>`) and verifies the write.
- Secrets are never returned by the API and never shown in previews/exports — the diff shows `•••`.

## 2. Open it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Desktop build: `npm run build`, then `npm run dist`.
Top-right: `عربي` toggles Arabic/RTL, sun/moon toggles dark mode (persisted).

## 3. Add a provider in 5 steps

**Simple / Advanced:** the form opens in Simple mode (essentials only). Switch to Advanced at the top for presets, model-to-edit, custom headers, and small model. In Simple mode, after each save the model field clears and focuses so you can type the next model ID — same provider, key, and capabilities.

### Step 1 — Pick where it goes
Top card **Config target**, default `Global`. `Project` / `Custom` need a folder/file path + `Apply` first — otherwise you are still editing Global. The resolved path is shown after Apply.

### Step 2 — Start from a preset (fastest)
Click a preset pill: `Ollama (local)`, `LM Studio (local)`, `llama.cpp`, `OpenRouter`, `RunInfra`, `Together AI`, `DeepSeek`, `Groq`. This fills Base URL + provider id. Local ones need only a dummy key (e.g. `ollama`).

Or pick `New provider` in the Provider dropdown, then Provider Type:
- `OpenAI-compatible` → uses fixed id `custom`
- `Custom` → type your own slug `^[a-z0-9-]{1,32}$` (e.g. `e2eprov`)

### Step 3 — Fill 3 required fields
- **Base URL**: `https://…/v1` (`http` allowed only for `localhost` / `127.0.0.1` / `.local` / private LAN). Trailing `/` is stripped.
- **API Key**: min 8 chars. When editing, **leave blank to keep the stored key**.
- **Model ID**: `^[A-Za-z0-9._:/-]{1,128}$` (e.g. `gpt-4o-mini`, `llama3.1:8b`).

Optional in the same card: `Context limit` / `Max output` (blank = omitted), `Tool calling` (on), `Reasoning` (off), `Attachments/images` (writes `modalities: {input: ["text","image"]}`), `Reasoning field`, Key storage (`Inline` / `Env var` / `File`), Custom headers (max 20), `Small model`.

### Step 4 — Test before you save
- **Test connection**: probes `{baseURL}/models`. Button stays disabled until Base URL + Model ID are filled.
- Discovered IDs are offered as clickable buttons to autofill Model ID.
- **Test prompt**: sends one tiny completion to prove the model answers. Reply is truncated for display.

> **Tip:** `Ctrl+Enter` reviews / confirms, `Escape` closes preview or cancels delete. Hint is shown under the submit row.

### Step 5 — Review config → Confirm & Apply
1. Click **Review config** — this only builds a redacted diff preview (`Review changes` dialog, secrets hidden).
2. Click **Confirm & Apply** to write. `Back to edit` cancels with nothing written.
3. Success banner: `Saved. Opencode will use it automatically.` + `Model: <provider>/<model>` + backup name. Run `opencode` — it picks it up automatically.

## 4. Everyday tasks

| Task | How |
|---|---|
| Edit | Provider dropdown → pick provider → values load → blank key keeps old key → Review → Confirm |
| Copy model ref | `Copy <provider>/<model>` button copies for opencode config/chat |
| Enable/disable | Gates card: `Enabled` / `Disabled` radios per provider (disabled wins) |
| Bulk delete | Manage card: search → check boxes → `Delete selected (N)` twice to confirm |
| Verify all | `Verify all endpoints` → `N of M endpoints reachable`; rows show `✓`/`!`, not just color |
| Backups | Backups card: sort newest/oldest/largest, paged 5/page → `Restore` (creates a safety backup first), `Undo last save` |
| Health | `Run checks` in Config health → `No issues found` or fix buttons for empty/keyless/dangling/limitless entries |
| History | Change history card, newest first, no secrets, paged |
| Move between machines | Export pack card → `Export pack` (redacted) → `Import pack` on other machine (keyless packs rejected) |
| Draft safety | Form autosaves locally **without the secret**; reload restores URLs/IDs, key stays blank |

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Red errors under Base URL / Key / Model | Validation failed | Use https URL, key ≥8 chars (or blank on edit), model matches allowed chars |
| `Test` buttons disabled | Required fields empty | Fill Base URL + Model ID |
| Saved wrong file | Target still Global | Set Project/Custom path + Apply, check resolved path line |
| `ENOENT` on first run | No config yet | Normal — file/dir is created |
| `EACCES/EPERM` | No home write perm | Run as user that owns home |
| Corrupt JSON | Bad manual edit | A `.corrupt-<ts>` copy is kept; Restore from `.bak.*` |
| Unsent changes warning on close | Dirty form | Review+Confirm, or Reset to discard |

## 6. Security notes

- Keys are stored per your Key-storage choice (inline/env/file), mode `0600` for key files; backups are full copies — protect your home dir.
- Preview/export/history redact keys and header values.
- Mutating APIs require same-origin (prevents random websites driving your local server).
- Never paste a real key into an untrusted Base URL then press Test — Test sends the key to that URL.

## 7. Next steps

- Add a second model to the same provider via `Model to edit` / `New model`.
- Run `Run checks` after every import.
- Keep one known-good backup before bulk deletes.
