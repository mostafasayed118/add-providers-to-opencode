import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  isAllowedUrl,
  providerSchema,
  type ProviderInput,
  type ProviderSummary,
} from "./provider-schema";

export { providerSchema, toFieldErrors } from "./provider-schema";
export type { FieldErrors, ProviderInput, ProviderSummary } from "./provider-schema";

export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

export type ConfigTarget =
  | { kind: "global" }
  | { kind: "project"; dir: string }
  | { kind: "custom"; path: string };

/** Resolve which config file an operation targets. Project dirs and custom
 *  parents must exist; the file itself is created on first write. */
export async function resolveConfigPath(t: unknown): Promise<string> {
  const target = (t ?? { kind: "global" }) as ConfigTarget;
  if (!target.kind || target.kind === "global") return getGlobalConfigPath();
  if (target.kind === "project") {
    if (typeof target.dir !== "string" || !target.dir.trim()) {
      throw new Error("Choose a project folder first.");
    }
    const dir = target.dir.trim();
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) throw new Error("Project folder not found.");
    return path.join(dir, "opencode.json");
  }
  if (target.kind === "custom") {
    if (typeof target.path !== "string" || !target.path.trim()) {
      throw new Error("Choose a config file first.");
    }
    const p = target.path.trim();
    const parent = path.dirname(p);
    const stat = await fs.stat(parent).catch(() => null);
    if (!stat?.isDirectory()) throw new Error("Folder not found.");
    if (!/\.jsonc?$/.test(p)) throw new Error("Config file must end in .json or .jsonc.");
    return p;
  }
  throw new Error("Unknown config target.");
}

export function targetLabel(t: ConfigTarget): string {
  if (t.kind === "project") return `project:${t.dir}`;
  if (t.kind === "custom") return t.path;
  return "global";
}

const LOCK_WAIT_MS = 10_000;
const LOCK_STALE_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serialize read-modify-write cycles on the global config. mkdir is atomic,
 * so the lock directory itself is the mutex; stale locks (crashed writers)
 * are reclaimed by age.
 */
export async function withConfigLock<T>(
  configPath: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockDir = `${configPath}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await fs.mkdir(lockDir);
      break;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
      try {
        const stat = await fs.stat(lockDir);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          "The opencode config is locked by another operation. Try again in a few seconds."
        );
      }
      await sleep(100);
    }
  }
  try {
    return await fn();
  } finally {
    await fs.rm(lockDir, { recursive: true, force: true });
  }
}

/** Pure mapping over an already-parsed config. Use to avoid a second fs.readFile. */
export function listProvidersFromExisting(
  existing: Record<string, unknown>
): ProviderSummary[] {
  const providers = (existing.provider as Record<string, unknown> | undefined) ?? {};
  return Object.entries(providers).map(([id, p]) => {
    const prov = (p ?? {}) as Record<string, unknown>;
    const options = (prov.options ?? {}) as Record<string, unknown>;
    const models = (prov.models ?? {}) as Record<string, unknown>;
    const apiKey = options.apiKey;
    const headers = (options.headers ?? {}) as Record<string, unknown>;
    return {
      id,
      name: typeof prov.name === "string" ? prov.name : null,
      baseURL: typeof options.baseURL === "string" ? options.baseURL : null,
      hasKey:
        typeof apiKey === "string" && apiKey.length > 0,
      keyRef: typeof apiKey === "string" ? parseKeyRef(apiKey) : null,
      headerNames: Object.keys(headers).filter((k) => typeof headers[k] === "string"),
      models: Object.entries(models).map(([mid, m]) => {
        const mm = (m ?? {}) as Record<string, unknown>;
        const limit = (mm.limit ?? null) as { context?: unknown; output?: unknown } | null;
        const modalities = (mm.modalities ?? null) as {
          input?: unknown;
          output?: unknown;
        } | null;
        const modalityInputs = Array.isArray(modalities?.input)
          ? (modalities.input as unknown[]).filter((x): x is string => typeof x === "string")
          : [];
        const interleaved = (mm as Record<string, unknown>).interleaved;
        return {
          id: mid,
          name: typeof mm.name === "string" ? mm.name : null,
          tool_call: mm.tool_call === true,
          reasoning: mm.reasoning === true,
          attachment: mm.attachment === true || modalityInputs.includes("image"),
          interleaved:
            typeof interleaved === "string"
              ? interleaved
              : typeof interleaved === "object" &&
                  interleaved !== null &&
                  typeof (interleaved as Record<string, unknown>).field === "string"
                ? ((interleaved as Record<string, unknown>).field as string)
                : null,
          limit:
            limit && typeof limit === "object"
              ? {
                  ...(typeof limit.context === "number" ? { context: limit.context } : {}),
                  ...(typeof limit.output === "number" ? { output: limit.output } : {}),
                }
              : null,
        };
      }),
    };
  });
}

export async function listProviders(configPath: string): Promise<ProviderSummary[]> {
  const existing = await readExistingConfig(configPath);
  return listProvidersFromExisting(existing);
}

/** Pure lookup over an already-parsed config. Use to avoid a second fs.readFile. */
export function getStoredApiKeyFromExisting(
  existing: Record<string, unknown>,
  providerId: string
): string | null {
  const providers = (existing.provider as Record<string, unknown> | undefined) ?? {};
  const prov = (providers[providerId] ?? {}) as Record<string, unknown>;
  const options = (prov.options ?? {}) as Record<string, unknown>;
  return typeof options.apiKey === "string" && options.apiKey.length > 0
    ? options.apiKey
    : null;
}

export async function getStoredApiKey(
  configPath: string,
  providerId: string
): Promise<string | null> {
  const existing = await readExistingConfig(configPath);
  return getStoredApiKeyFromExisting(existing, providerId);
}

export type KeyRef = { kind: "env" | "file"; name: string } | null;

export type GateState = "auto" | "enabled" | "disabled";

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

/** Provider allow/deny lists. disabled wins over enabled (opencode rule). */
export function getProviderGates(existing: Record<string, unknown>): {
  enabled: string[];
  disabled: string[];
} {
  return {
    enabled: stringList(existing.enabled_providers),
    disabled: stringList(existing.disabled_providers),
  };
}

export function gateOf(
  existing: Record<string, unknown>,
  providerId: string
): GateState {
  const { enabled, disabled } = getProviderGates(existing);
  if (disabled.includes(providerId)) return "disabled";
  if (enabled.includes(providerId)) return "enabled";
  return "auto";
}

export function withGate(
  existing: Record<string, unknown>,
  providerId: string,
  state: GateState
): Record<string, unknown> {
  const { enabled, disabled } = getProviderGates(existing);
  const next = { ...existing };
  const set = (ids: string[]) => [...new Set(ids)];
  if (state === "disabled") {
    next.disabled_providers = set([...disabled, providerId]);
    next.enabled_providers = enabled.filter((x) => x !== providerId);
  } else if (state === "enabled") {
    next.enabled_providers = set([...enabled, providerId]);
    next.disabled_providers = disabled.filter((x) => x !== providerId);
  } else {
    next.enabled_providers = enabled.filter((x) => x !== providerId);
    next.disabled_providers = disabled.filter((x) => x !== providerId);
    if ((next.enabled_providers as string[]).length === 0) delete next.enabled_providers;
    if ((next.disabled_providers as string[]).length === 0) delete next.disabled_providers;
  }
  return next;
}

export async function setProviderGate(
  configPath: string,
  providerId: string,
  state: GateState
): Promise<void> {
  const id = providerId.trim().toLowerCase();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);
    const providers = ((existing.provider as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    if (!(id in providers)) throw new Error(`Provider "${id}" does not exist.`);
    const next = withGate(existing, id, state);
    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);
  });
}

export async function deleteManyProviders(
  configPath: string,
  providerIds: string[]
): Promise<{ backup: string | null; clearedActiveModel: boolean; newModel: string | null }> {
  const ids = [...new Set(providerIds.map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    100
  );
  if (ids.length === 0) throw new Error("No providers selected.");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);
    const providers = { ...((existing.provider as Record<string, unknown> | undefined) ?? {}) };
    const missing = ids.filter((id) => !(id in providers));
    if (missing.length > 0) throw new Error(`Unknown providers: ${missing.join(", ")}.`);
    let backup: string | null = null;
    try {
      await fs.access(configPath);
      backup = `${configPath}.bak.${Date.now()}`;
      await fs.copyFile(configPath, backup);
    } catch {
      backup = null;
    }
    for (const id of ids) delete providers[id];
    let clearedActiveModel = false;
    let newModel = (existing as { model?: unknown }).model ?? null;
    const currentModel = newModel;
    if (
      typeof currentModel === "string" &&
      ids.some((id) => currentModel.toLowerCase().startsWith(`${id}/`))
    ) {
      clearedActiveModel = true;
      newModel = null;
      for (const [pid, p] of Object.entries(providers)) {
        const models = ((p as Record<string, unknown>).models ?? {}) as Record<string, unknown>;
        const first = Object.keys(models)[0];
        if (first) {
          newModel = `${pid}/${first}`;
          break;
        }
      }
    }
    const next: Record<string, unknown> = { ...existing, provider: providers };
    if (newModel) next.model = newModel;
    else delete next.model;
    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);
    return {
      backup,
      clearedActiveModel,
      newModel: typeof newModel === "string" ? newModel : null,
    };
  });
}

export type ImportedPack = {
  providers: Record<string, Record<string, unknown>>;
};

/**
 * Validate an imported provider pack. Secrets must be present per provider
 * (inline key or env/file reference) — importing keyless entries silently
 * would create dead providers.
 */
export function validatePack(pack: unknown): { ok: true; pack: ImportedPack } | { ok: false; error: string } {
  if (pack === null || typeof pack !== "object" || Array.isArray(pack)) {
    return { ok: false, error: "Pack must be a JSON object with a providers map." };
  }
  const root = pack as Record<string, unknown>;
  const rawProviders = root.providers ?? root;
  if (rawProviders === null || typeof rawProviders !== "object" || Array.isArray(rawProviders)) {
    return { ok: false, error: "Pack must contain a providers object." };
  }
  const providers: ImportedPack["providers"] = {};
  for (const [pid, p] of Object.entries(rawProviders as Record<string, unknown>)) {
    const shortPid = pid.slice(0, 100);
    if (!/^[a-z0-9-]{1,32}$/.test(pid)) {
      return { ok: false, error: `Bad provider id "${shortPid}".` };
    }
    if (p === null || typeof p !== "object" || Array.isArray(p)) {
      return { ok: false, error: `Provider "${shortPid}" must be an object.` };
    }
    const prov = p as Record<string, unknown>;
    const options = prov.options;
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      return { ok: false, error: `Provider "${shortPid}" needs options with baseURL and apiKey.` };
    }
    const opts = options as Record<string, unknown>;
    if (typeof opts.baseURL !== "string" || !opts.baseURL) {
      return { ok: false, error: `Provider "${shortPid}" needs options.baseURL.` };
    }
    if (opts.baseURL.length > 2048 || !isAllowedUrl(opts.baseURL)) {
      return { ok: false, error: `Provider "${shortPid}" has an invalid baseURL.` };
    }
    if (typeof opts.apiKey !== "string" || !opts.apiKey) {
      return { ok: false, error: `Provider "${shortPid}" has no key. Add apiKey (or an {env:}/{file:} reference) before importing.` };
    }
    if (opts.apiKey.length > 8192) {
      return { ok: false, error: `Provider "${shortPid}" key is too long.` };
    }
    if (/^\u2022+$/.test(opts.apiKey)) {
      return { ok: false, error: `Provider "${shortPid}" carries a redacted placeholder, not a real key. Re-enter the key before importing.` };
    }
    const models = prov.models;
    if (models === null || typeof models !== "object" || Array.isArray(models) || Object.keys(models).length === 0) {
      return { ok: false, error: `Provider "${shortPid}" needs at least one model.` };
    }
    // Allowlist known provider fields; drop unknown extra keys verbatim.
    const cleanOptions: Record<string, unknown> = {
      baseURL: opts.baseURL,
      apiKey: opts.apiKey,
    };
    if (opts.headers !== null && typeof opts.headers === "object" && !Array.isArray(opts.headers)) {
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts.headers as Record<string, unknown>)) {
        if (typeof v !== "string") continue;
        if (k.length === 0 || k.length > 128) continue;
        h[k.slice(0, 128)] = v.slice(0, 4096);
        if (Object.keys(h).length >= 20) break;
      }
      if (Object.keys(h).length > 0) cleanOptions.headers = h;
    }
    const cleanModels: Record<string, unknown> = {};
    for (const [mid, m] of Object.entries(models as Record<string, unknown>)) {
      if (typeof mid !== "string" || !mid || mid.length > 128) continue;
      if (m === null || typeof m !== "object" || Array.isArray(m)) continue;
      const mm = m as Record<string, unknown>;
      const cleanM: Record<string, unknown> = {};
      if (typeof mm.name === "string") cleanM.name = mm.name.slice(0, 256);
      if (typeof mm.tool_call === "boolean") cleanM.tool_call = mm.tool_call;
      if (typeof mm.reasoning === "boolean") cleanM.reasoning = mm.reasoning;
      if (typeof mm.attachment === "boolean") cleanM.attachment = mm.attachment;
      if (typeof mm.interleaved === "string") cleanM.interleaved = mm.interleaved.slice(0, 64);
      else if (mm.interleaved !== null && typeof mm.interleaved === "object" && !Array.isArray(mm.interleaved)) {
        const f = (mm.interleaved as Record<string, unknown>).field;
        if (typeof f === "string") cleanM.interleaved = { field: f.slice(0, 64) };
      }
      if (mm.limit !== null && typeof mm.limit === "object" && !Array.isArray(mm.limit)) {
        const lim = mm.limit as Record<string, unknown>;
        const cleanLim: Record<string, unknown> = {};
        if (typeof lim.context === "number" && Number.isInteger(lim.context) && lim.context > 0 && lim.context <= 10_000_000) cleanLim.context = lim.context;
        if (typeof lim.output === "number" && Number.isInteger(lim.output) && lim.output > 0 && lim.output <= 10_000_000) cleanLim.output = lim.output;
        if (Object.keys(cleanLim).length > 0) cleanM.limit = cleanLim;
      }
      if (mm.modalities !== null && typeof mm.modalities === "object" && !Array.isArray(mm.modalities)) {
        const mod = mm.modalities as Record<string, unknown>;
        const cleanMod: Record<string, unknown> = {};
        if (Array.isArray(mod.input)) {
          const inp = mod.input.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 32)).slice(0, 10);
          if (inp.length > 0) cleanMod.input = inp;
        }
        if (Array.isArray(mod.output)) {
          const outp = mod.output.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 32)).slice(0, 10);
          if (outp.length > 0) cleanMod.output = outp;
        }
        if (Object.keys(cleanMod).length > 0) cleanM.modalities = cleanMod;
      }
      cleanModels[mid.slice(0, 128)] = cleanM;
    }
    if (Object.keys(cleanModels).length === 0) {
      return { ok: false, error: `Provider "${shortPid}" needs at least one model.` };
    }
    providers[pid] = {
      npm: typeof prov.npm === "string" ? prov.npm.slice(0, 256) : "@ai-sdk/openai-compatible",
      ...(typeof prov.name === "string" ? { name: prov.name.slice(0, 256) } : {}),
      options: cleanOptions,
      models: cleanModels,
    };
  }
  if (Object.keys(providers).length === 0) {
    return { ok: false, error: "Pack contains no providers." };
  }
  return { ok: true, pack: { providers } };
}

export async function importPack(
  configPath: string,
  pack: ImportedPack
): Promise<{ backup: string | null; imported: string[] }> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);
    let backup: string | null = null;
    try {
      await fs.access(configPath);
      backup = `${configPath}.bak.${Date.now()}`;
      await fs.copyFile(configPath, backup);
    } catch {
      backup = null;
    }
    const providers = { ...((existing.provider as Record<string, unknown> | undefined) ?? {}) };
    for (const [pid, entry] of Object.entries(pack.providers)) {
      providers[pid] = entry;
    }
    const next = { ...existing, provider: providers };
    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);
    return { backup, imported: Object.keys(pack.providers) };
  });
}

export async function configMtimeMs(configPath: string): Promise<number | null> {
  try {
    return (await fs.stat(configPath)).mtimeMs;
  } catch {
    return null;
  }
}

const SECRET_KEYS = new Set(["apiKey", "api_key", "token", "secret"]);

/**
 * Deep copy with secret values replaced by a placeholder. Used for previews
 * and logs so stored secrets the user never typed are never rendered.
 */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSecrets) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) {
        out[k] = typeof v === "string" && v.length > 0 ? "•••" : v;
      } else if (k === "headers" && v !== null && typeof v === "object" && !Array.isArray(v)) {
        const h: Record<string, unknown> = {};
        for (const [hk, hv] of Object.entries(v as Record<string, unknown>)) {
          h[hk] = typeof hv === "string" && hv.length > 0 ? "•••" : hv;
        }
        out[k] = h;
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out as T;
  }
  return value;
}

export type BackupInfo = {
  file: string;
  kind: "backup" | "corrupt";
  bytes: number;
  mtimeMs: number;
};

/** List timestamped backups + corrupt copies next to the config. Newest first. */
export async function listBackups(configPath: string): Promise<BackupInfo[]> {
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}\\.(bak\\.\\d+|corrupt-\\d+)$`);
  const infos = names.filter((name) => re.test(name));
  const out = (
    await Promise.all(
      infos.map(async (name): Promise<BackupInfo | null> => {
        const m = re.exec(name);
        if (!m) return null;
        try {
          const stat = await fs.stat(path.join(dir, name));
          return {
            file: name,
            kind: m[1].startsWith("bak.") ? "backup" : "corrupt",
            bytes: stat.size,
            mtimeMs: stat.mtimeMs,
          };
        } catch {
          // Vanished mid-listing; skip.
          return null;
        }
      })
    )
  ).filter((x): x is BackupInfo => x !== null);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

const BACKUP_NAME = /^opencode\.json\.(bak\.\d+|corrupt-\d+)$/;

/** Restore a backup over the live config (after backing up the live file). */
export async function restoreBackup(
  configPath: string,
  file: string
): Promise<{ model: string | null }> {
  if (!BACKUP_NAME.test(file)) {
    throw new Error("Refusing to restore an unrecognized file.");
  }
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const src = path.join(path.dirname(configPath), file);
    let raw: string;
    try {
      raw = await fs.readFile(src, "utf8");
    } catch {
      throw new Error("Backup file no longer exists.");
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("Backup is not valid JSON; live config left untouched.");
    }
    try {
      await fs.access(configPath);
      await fs.copyFile(configPath, `${configPath}.bak.${Date.now()}`);
    } catch {
      // No live file yet; nothing to preserve.
    }
    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, raw.endsWith("\n") ? raw : raw + "\n", "utf8");
    await fs.rename(tmp, configPath);
    const model = (parsed as { model?: unknown }).model;
    return { model: typeof model === "string" ? model : null };
  });
}

/** Detect opencode `{env:NAME}` / `{file:path}` secret references. */
export function parseKeyRef(value: string): KeyRef {
  const env = /^\{env:(.+)\}$/.exec(value.trim());
  if (env) return { kind: "env", name: env[1] };
  const file = /^\{file:(.+)\}$/.exec(value.trim());
  if (file) return { kind: "file", name: file[1] };
  return null;
}

/** Write a key file with owner-only permissions; no trailing newline. */
export async function writeKeyFile(filePath: string, secret: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, secret, { encoding: "utf8", mode: 0o600 });
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // Windows ACLs ignore POSIX modes; best effort only.
  }
}

export async function getStoredHeaders(
  configPath: string,
  providerId: string
): Promise<Record<string, string>> {
  const existing = await readExistingConfig(configPath);
  const providers = (existing.provider as Record<string, unknown> | undefined) ?? {};
  const prov = (providers[providerId] ?? {}) as Record<string, unknown>;
  const options = (prov.options ?? {}) as Record<string, unknown>;
  const headers = (options.headers ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function readExistingConfig(
  configPath: string
): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e?.code === "ENOENT") return {};
    // Preserve corrupt file for recovery, then surface clear error
    try {
      const corruptBackup = `${configPath}.corrupt-${Date.now()}`;
      const raw = await fs.readFile(configPath, "utf8").catch(() => "");
      await fs.writeFile(corruptBackup, raw, "utf8");
    } catch {
      // ignore backup failure; original error matters more
    }
    throw new Error(
      "Existing opencode.json is not valid JSON. A .corrupt backup was saved next to it."
    );
  }
}

export function buildProviderBlock(input: ProviderInput & { api_key: string }): {
  providerId: string;
  entry: Record<string, unknown>;
  model: string;
} {
  const providerId =
    input.providerType === "openai-compatible" ? "custom" : input.providerId;
  const modelEntry: Record<string, unknown> = {
    name: input.model_id,
    tool_call: input.tool_call,
    reasoning: input.reasoning,
    attachment: input.attachment,
    // Drives opencode's Inputs panel + image capability check. Without this,
    // custom OpenAI-compatible models default to text-only and images are stripped.
    modalities: {
      input: input.attachment ? ["text", "image"] : ["text"],
      output: ["text"],
    },
  };
  // Streamed-thinking field for providers (e.g. GLM) that send reasoning in a
  // custom message field. String form is accepted by opencode.
  if (input.reasoning_field) modelEntry.interleaved = input.reasoning_field;
  if (input.context_limit != null || input.output_limit != null) {
    modelEntry.limit = {
      ...(input.context_limit != null ? { context: input.context_limit } : {}),
      ...(input.output_limit != null ? { output: input.output_limit } : {}),
    };
  }
  const entry: Record<string, unknown> = {
    npm: "@ai-sdk/openai-compatible",
    name: input.providerType === "openai-compatible" ? "Custom OpenAI-compatible" : providerId,
    options: {
      baseURL: input.base_url,
      apiKey: input.api_key,
    },
    models: {
      [input.model_id]: modelEntry,
    },
  };
  const headerEntries = (input.headers ?? []).filter((h) => h.name.trim() !== "");
  if (headerEntries.length > 0) {
    (entry.options as Record<string, unknown>).headers = Object.fromEntries(
      headerEntries.map((h) => [h.name.trim(), h.value])
    );
  }
  return { providerId, entry, model: `${providerId}/${input.model_id}` };
}

export type MergedConfig = {
  providers: Record<string, unknown>;
  providerId: string;
  entry: Record<string, unknown>;
  model: string;
};

/**
 * Pure merge of one provider entry into an existing config object.
 * Shared by save (writes it) and preview (only displays the diff).
 */
export function mergeProviderEntry(
  existing: Record<string, unknown>,
  parsed: ProviderInput & { api_key: string }
): MergedConfig {
  const { providerId, entry, model } = buildProviderBlock(parsed);
  const existingProviders =
    (existing.provider as Record<string, unknown> | undefined) ?? {};
  // Merge into the existing provider entry instead of replacing it, so
  // sibling models and extra options (e.g. headers) survive an edit.
  const prevEntry = (existingProviders[providerId] ?? {}) as Record<string, unknown>;
  const prevOptions = (prevEntry.options ?? {}) as Record<string, unknown>;
  const prevModels = { ...((prevEntry.models ?? {}) as Record<string, unknown>) };
  if (parsed.editModelId && parsed.editModelId !== parsed.model_id) {
    delete prevModels[parsed.editModelId];
  }
  const prevModel = (prevModels[parsed.model_id] ?? {}) as Record<string, unknown>;
  const newModels = (entry.models ?? {}) as Record<string, unknown>;
  const newModel = newModels[parsed.model_id] as Record<string, unknown>;
  prevModels[parsed.model_id] = {
    ...prevModel,
    ...newModel,
    name: typeof prevModel.name === "string" ? prevModel.name : parsed.model_id,
  };
  const nextEntry: Record<string, unknown> = {
    ...prevEntry,
    ...entry,
    options: { ...prevOptions, ...(entry.options as Record<string, unknown>) },
    models: prevModels,
  };
  // First save ever decides the npm package; keep a stored one if present.
  if (typeof prevEntry.npm === "string") nextEntry.npm = prevEntry.npm;
  return {
    providers: { ...existingProviders, [providerId]: nextEntry },
    providerId,
    entry: nextEntry,
    model,
  };
}

export async function saveProviderConfig(
  input: unknown,
  configPath: string = getGlobalConfigPath()
): Promise<{
  path: string;
  model: string;
  backup: string | null;
}> {
  const parsed = providerSchema.parse(input);
  const apiKey = parsed.api_key;
  if (!apiKey) {
    // The save route fills a blank key from the stored provider before calling
    // here; reaching this means a programming error, not user input.
    throw new Error("api_key is required to save a provider.");
  }
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);

    let backup: string | null = null;
    try {
      await fs.access(configPath);
      backup = `${configPath}.bak.${Date.now()}`;
      await fs.copyFile(configPath, backup);
    } catch {
      backup = null;
    }

    const merged = mergeProviderEntry(existing, { ...parsed, api_key: apiKey });
    const next: Record<string, unknown> = {
      ...existing,
      provider: merged.providers,
      model: merged.model,
    };
    // small_model is opt-in: only overwrite when the form provided one,
    // otherwise a blank field must not wipe the stored value.
    if (parsed.small_model) next.small_model = parsed.small_model;

    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);

    // Read-back verification (never log secrets)
    const verifyRaw = await fs.readFile(configPath, "utf8");
    const verify = JSON.parse(verifyRaw) as Record<string, unknown>;
    if ((verify as { model?: unknown }).model !== merged.model) {
      throw new Error("Write verification failed: model mismatch after save.");
    }
    return { path: configPath, model: merged.model, backup };
  });
}

export async function deleteProvider(
  configPath: string,
  providerId: string
): Promise<{ backup: string | null; clearedActiveModel: boolean; newModel: string | null }> {
  // Provider ids are normalized to lowercase slugs on save (zod transform),
  // so normalize here too — otherwise "MyProv" would never match "myprov".
  const id = providerId.trim().toLowerCase();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);
    const providers = { ...((existing.provider as Record<string, unknown> | undefined) ?? {}) };
    if (!(id in providers)) {
      throw new Error(`Provider "${id}" does not exist.`);
    }
    let backup: string | null = null;
    try {
      await fs.access(configPath);
      backup = `${configPath}.bak.${Date.now()}`;
      await fs.copyFile(configPath, backup);
    } catch {
      backup = null;
    }
    delete providers[id];

    let clearedActiveModel = false;
    let newModel = (existing as { model?: unknown }).model ?? null;
    // Compare case-insensitively: hand-edited configs may carry any case,
    // while saves always write the lowercased provider id.
    if (
      typeof newModel === "string" &&
      newModel.toLowerCase().startsWith(`${id}/`)
    ) {
      clearedActiveModel = true;
      newModel = null;
      for (const [pid, p] of Object.entries(providers)) {
        const models = ((p as Record<string, unknown>).models ?? {}) as Record<string, unknown>;
        const first = Object.keys(models)[0];
        if (first) {
          newModel = `${pid}/${first}`;
          break;
        }
      }
    }

    const next: Record<string, unknown> = { ...existing, provider: providers };
    if (newModel) next.model = newModel;
    else delete next.model;

    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);
    return {
      backup,
      clearedActiveModel,
      newModel: typeof newModel === "string" ? newModel : null,
    };
  });
}

function uniqueCopyId(existing: Record<string, unknown>, base: string): string {
  if (!(base in existing)) return base;
  let i = 2;
  while (`${base}-copy${i === 2 ? "" : `-${i}`}` in existing) i++;
  return `${base}-copy${i === 2 ? "" : `-${i}`}`;
}

/** Duplicate a provider entry (key included) so settings can be tried safely. */
export async function cloneProvider(
  configPath: string,
  providerId: string
): Promise<{ newId: string; backup: string | null }> {
  const id = providerId.trim().toLowerCase();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  return withConfigLock(configPath, async () => {
    const existing = await readExistingConfig(configPath);
    const providers = { ...((existing.provider as Record<string, unknown> | undefined) ?? {}) };
    const src = providers[id];
    if (src === undefined) {
      throw new Error(`Provider "${id}" does not exist.`);
    }
    const newId = uniqueCopyId(providers, `${id}-copy`);
    // Deep copy so later edits of either side never alias.
    providers[newId] = JSON.parse(JSON.stringify(src)) as unknown;
    (providers[newId] as Record<string, unknown>).name =
      typeof (src as Record<string, unknown>).name === "string"
        ? `${(src as Record<string, unknown>).name} (copy)`
        : newId;
    let backup: string | null = null;
    try {
      await fs.access(configPath);
      backup = `${configPath}.bak.${Date.now()}`;
      await fs.copyFile(configPath, backup);
    } catch {
      backup = null;
    }
    const next = { ...existing, provider: providers };
    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);
    return { newId, backup };
  });
}

export type HistoryAction = "save" | "delete" | "restore" | "clone";

function historyPath(configPath: string): string {
  return path.join(path.dirname(configPath), "provider-tool-history.jsonl");
}

/** Append-only local audit log (no secrets — ids and model refs only). */
export async function logHistory(
  configPath: string,
  action: HistoryAction,
  detail: Record<string, string | null>
): Promise<void> {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), action, ...detail }) + "\n";
    await fs.appendFile(historyPath(configPath), line, "utf8");
  } catch {
    // History is best-effort; never fail the operation for it.
  }
}

export type HistoryEntry = {
  ts: string;
  action: HistoryAction;
  provider?: string | null;
  model?: string | null;
};

export async function readHistory(configPath: string, limit = 50): Promise<HistoryEntry[]> {
  try {
    const raw = await fs.readFile(historyPath(configPath), "utf8");
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    const out: HistoryEntry[] = [];
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as HistoryEntry;
        if (typeof e.ts === "string" && typeof e.action === "string") out.push(e);
      } catch {
        // Skip torn trailing line from a concurrent append.
      }
    }
    return out.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export type DoctorIssue = {
  id: string;
  level: "error" | "warn";
  provider?: string;
  message: string;
  fixable: boolean;
};

/** Static health checks over the whole file. No network involved. */
export function checkConfig(existing: Record<string, unknown>): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  const providers = ((existing.provider as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const [pid, p] of Object.entries(providers)) {
    const prov = (p ?? {}) as Record<string, unknown>;
    const options = (prov.options ?? {}) as Record<string, unknown>;
    const models = (prov.models ?? {}) as Record<string, unknown>;
    if (Object.keys(models).length === 0) {
      issues.push({
        id: `empty:${pid}`,
        level: "error",
        provider: pid,
        message: `Provider "${pid}" has no models and will never be selectable.`,
        fixable: true,
      });
    }
    if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
      issues.push({
        id: `nokey:${pid}`,
        level: "error",
        provider: pid,
        message: `Provider "${pid}" has no API key configured.`,
        fixable: false,
      });
    }
    if (typeof options.baseURL === "string") {
      let ok = true;
      try {
        const u = new URL(options.baseURL);
        ok = u.protocol === "https:" || u.protocol === "http:";
      } catch {
        ok = false;
      }
      if (!ok) {
        issues.push({
          id: `badurl:${pid}`,
          level: "error",
          provider: pid,
          message: `Provider "${pid}" has an invalid baseURL.`,
          fixable: false,
        });
      }
    }
    for (const [mid, m] of Object.entries(models)) {
      const mm = (m ?? {}) as Record<string, unknown>;
      const limit = (mm.limit ?? null) as { context?: unknown } | null;
      if (!limit || typeof limit.context !== "number") {
        issues.push({
          id: `nolimit:${pid}/${mid}`,
          level: "warn",
          provider: pid,
          message: `Model "${mid}" has no context limit; opencode shows Context 0.`,
          fixable: false,
        });
      }
    }
  }
  const model = (existing as { model?: unknown }).model;
  if (typeof model === "string" && model.includes("/")) {
    const slash = model.indexOf("/");
    const pid = model.slice(0, slash).toLowerCase();
    const mid = model.slice(slash + 1);
    const prov = providers[pid] as Record<string, unknown> | undefined;
    const models = ((prov?.models ?? {}) as Record<string, unknown>) ?? {};
    const found =
      prov !== undefined &&
      (mid in models ||
        Object.keys(models).some((k) => k.toLowerCase() === mid.toLowerCase()));
    if (!found) {
      issues.push({
        id: "dangling-model",
        level: "error",
        message: `Active model "${model}" does not match any configured provider/model.`,
        fixable: true,
      });
    }
  }
  return issues;
}
