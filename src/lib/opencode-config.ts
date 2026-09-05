import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  providerSchema,
  type ProviderInput,
  type ProviderSummary,
} from "./provider-schema";

export { providerSchema, toFieldErrors } from "./provider-schema";
export type { FieldErrors, ProviderInput, ProviderSummary } from "./provider-schema";

export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
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

export async function listProviders(configPath: string): Promise<ProviderSummary[]> {
  const existing = await readExistingConfig(configPath);
  const providers = (existing.provider as Record<string, unknown> | undefined) ?? {};
  return Object.entries(providers).map(([id, p]) => {
    const prov = (p ?? {}) as Record<string, unknown>;
    const options = (prov.options ?? {}) as Record<string, unknown>;
    const models = (prov.models ?? {}) as Record<string, unknown>;
    return {
      id,
      name: typeof prov.name === "string" ? prov.name : null,
      baseURL: typeof options.baseURL === "string" ? options.baseURL : null,
      hasKey:
        typeof options.apiKey === "string" && options.apiKey.length > 0,
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
        return {
          id: mid,
          name: typeof mm.name === "string" ? mm.name : null,
          tool_call: mm.tool_call === true,
          reasoning: mm.reasoning === true,
          attachment: mm.attachment === true || modalityInputs.includes("image"),
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

export async function getStoredApiKey(
  configPath: string,
  providerId: string
): Promise<string | null> {
  const existing = await readExistingConfig(configPath);
  const providers = (existing.provider as Record<string, unknown> | undefined) ?? {};
  const prov = (providers[providerId] ?? {}) as Record<string, unknown>;
  const options = (prov.options ?? {}) as Record<string, unknown>;
  return typeof options.apiKey === "string" && options.apiKey.length > 0
    ? options.apiKey
    : null;
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
  return { providerId, entry, model: `${providerId}/${input.model_id}` };
}

export async function saveProviderConfig(input: ProviderInput): Promise<{
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
  const configPath = getGlobalConfigPath();
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

    const { providerId, entry, model } = buildProviderBlock({
      ...parsed,
      api_key: apiKey,
    });
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
    const next = {
      ...existing,
      provider: { ...existingProviders, [providerId]: nextEntry },
      model,
    };

    const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, configPath);

    // Read-back verification (never log secrets)
    const verifyRaw = await fs.readFile(configPath, "utf8");
    const verify = JSON.parse(verifyRaw) as Record<string, unknown>;
    if ((verify as { model?: unknown }).model !== model) {
      throw new Error("Write verification failed: model mismatch after save.");
    }
    return { path: configPath, model, backup };
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
