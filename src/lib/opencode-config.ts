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
  const existing = await readExistingConfig(configPath);

  let backup: string | null = null;
  try {
    await fs.access(configPath);
    backup = `${configPath}.bak.${Date.now()}`;
    await fs.copyFile(configPath, backup);
  } catch {
    backup = null;
  }

  const { providerId, entry, model } = buildProviderBlock({ ...parsed, api_key: apiKey });
  const existingProvider =
    (existing.provider as Record<string, unknown> | undefined) ?? {};
  const next = {
    ...existing,
    provider: { ...existingProvider, [providerId]: entry },
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
}
