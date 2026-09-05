import { z } from "zod";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

function isAllowedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") {
    return LOCAL_HOSTS.test(u.hostname);
  }
  return false;
}

export const providerSchema = z.object({
  base_url: z
    .string()
    .trim()
    .min(1, "base_url is required")
    .max(2048, "base_url is too long")
    .refine((v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, "base_url must be a valid URL (e.g. https://api.example.com/v1)")
    .refine((v) => isAllowedUrl(v), {
      message:
        "base_url must use https, except http://localhost / 127.0.0.1 / .local / private LAN",
    })
    .transform((v) => v.replace(/\/+$/, "")),
  api_key: z
    .string()
    .trim()
    .min(8, "api_key must be at least 8 characters")
    .max(4096, "api_key is too long")
    .refine((v) => v.length > 0, "api_key is required"),
  model_id: z
    .string()
    .trim()
    .min(1, "model_id is required")
    .max(128, "model_id is too long")
    .regex(
      /^[A-Za-z0-9._:/-]{1,128}$/,
      "model_id may only contain letters, numbers, . _ : / - (no spaces)"
    ),
  providerType: z.enum(["openai-compatible", "custom"], {
    errorMap: () => ({ message: "Choose OpenAI-compatible or custom" }),
  }),
  providerId: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "provider id is required for custom")
    .max(32)
    .regex(/^[a-z0-9-]{1,32}$/, "provider id: lowercase letters, numbers, dash only")
    .default("custom"),
  context_limit: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int("context limit must be a whole number").positive("context limit must be positive").max(10000000, "context limit is too large").optional()
  ),
  output_limit: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int("output limit must be a whole number").positive("output limit must be positive").max(10000000, "output limit is too large").optional()
  ),
  tool_call: z.coerce.boolean().default(true),
  reasoning: z.coerce.boolean().default(false),
  attachment: z.coerce.boolean().default(false),
});

export type ProviderInput = z.infer<typeof providerSchema>;

export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

export type ProviderSummary = {
  id: string;
  name: string | null;
  baseURL: string | null;
  hasKey: boolean;
  models: Array<{
    id: string;
    name: string | null;
    tool_call: boolean;
    reasoning: boolean;
    attachment: boolean;
    limit: { context?: number; output?: number } | null;
  }>;
};

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

export function buildProviderBlock(input: ProviderInput): {
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

function redact(_value: string): string {
  return "****";
}

export async function saveProviderConfig(input: ProviderInput): Promise<{
  path: string;
  model: string;
  backup: string | null;
}> {
  const parsed = providerSchema.parse(input);
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

  const { providerId, entry, model } = buildProviderBlock(parsed);
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
  void redact;
  return { path: configPath, model, backup };
}
