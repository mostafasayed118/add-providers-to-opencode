# Opencode Provider Config Tool

Desktop-ready form to collect `base_url`, `api_key`, `model_id` (+ provider type
OpenAI-compatible / custom) and apply it to the **global** opencode config so
running `opencode` reflects it automatically.

## Run end-to-end

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production web:

```bash
npm run build
npm start
```

Desktop (Electron):

```bash
npm run build
# dev shell (needs Next dev running separately):
# ELECTRON_DEV=1 npm run dev  (terminal 1)
# ELECTRON_DEV=1 npm run electron:dev  (terminal 2)
npm run dist
```

## Editing existing providers

The form's Provider dropdown lists every provider in the global config.
Picking one loads its base URL, first model, and capabilities into the form —
leave **API Key blank to keep the stored key**, or type a new one to replace it.
Saving a new provider id still requires a key. Secrets are never returned by the API.

## Where it writes

- Global path resolved via `os.homedir()`: `~/.config/opencode/opencode.json`
- Windows: `%USERPROFILE%\.config\opencode\opencode.json`
- Before overwrite: timestamped backup `opencode.json.bak.<ts>`
- Atomic write via tmp + rename, then read-back verification
- Sets top-level `model: "<providerId>/<model_id>"`

OpenAI-compatible uses provider id `custom` with `npm: @ai-sdk/openai-compatible`.
Custom uses your lowercase slug provider id.

## Validation

- `base_url`: valid URL, `https` except `http://localhost|127.0.0.1|.local|private LAN`, trailing `/` stripped
- `api_key`: min 8 chars, never logged, never returned by GET
- `model_id`: `^[A-Za-z0-9._:/-]{1,128}$`
- Optional capabilities: `context_limit` / `output_limit` (positive ints, blank = omitted),
  `tool_call` (default on), `reasoning` (default off), `attachment` (default off) —
  these populate opencode's Context / Reasoning / Inputs panel for the model.
  Attachments specifically writes `modalities: { input: ["text", "image"] }`, which is
  the field opencode actually checks before accepting image input (`attachment: true`
  alone is not enough).
- Server mirrors client validation via zod; 400 returns field-errors map.

## Troubleshooting

- `ENOENT` on first run is normal — directory/file is created.
- `EACCES/EPERM` — run as a user with home write permission.
- Corrupt existing JSON — a `.corrupt-<ts>` copy is saved next to it; restore from `.bak.*` if needed.
