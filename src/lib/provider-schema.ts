import { z } from "zod";

// Single source of truth for provider validation. This module must stay
// free of Node.js imports so both the browser form and the API routes
// can validate with the exact same rules.

export const MIN_KEY_LENGTH = 8;
export const MAX_KEY_LENGTH = 4096;
export const MAX_URL_LENGTH = 2048;
export const MAX_LIMIT = 10_000_000;

const LOCAL_HOSTS =
  /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

export function isAllowedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return LOCAL_HOSTS.test(u.hostname);
  return false;
}

const optionalPositiveInt = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .int(`${label} must be a whole number`)
      .positive(`${label} must be positive`)
      .max(MAX_LIMIT, `${label} is too large`)
      .optional()
  );

export const providerSchema = z.object({
  base_url: z
    .string()
    .trim()
    .min(1, "base_url is required")
    .max(MAX_URL_LENGTH, "base_url is too long")
    .refine(
      (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      "base_url must be a valid URL (e.g. https://api.example.com/v1)"
    )
    .refine(isAllowedUrl, {
      message:
        "base_url must use https, except http://localhost / 127.0.0.1 / .local / private LAN",
    })
    .transform((v) => v.replace(/\/+$/, "")),
  // Optional here: the save route fills a blank key from the stored provider
  // (edit flow). New providers are rejected there when no stored key exists.
  api_key: z
    .string()
    .trim()
    .max(MAX_KEY_LENGTH, "api_key is too long")
    .optional()
    .refine((v) => v === undefined || v.length >= MIN_KEY_LENGTH, {
      message: `api_key must be at least ${MIN_KEY_LENGTH} characters`,
    }),
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
  context_limit: optionalPositiveInt("context limit"),
  output_limit: optionalPositiveInt("output limit"),
  // Original model id when renaming during edit; the old entry is removed.
  editModelId: z.string().trim().max(128).optional(),
  // Streamed-thinking field for providers like GLM that send reasoning in a
  // custom message field. Matches opencode's `interleaved` model option
  // ("reasoning" | "reasoning_content" | "reasoning_text"); omit for none.
  reasoning_field: z.enum(["reasoning", "reasoning_content", "reasoning_text"]).optional(),
  // How the secret reaches opencode: inline in the config, or as a
  // reference that keeps it out of the file. Blank key on edit keeps stored.
  keyStorage: z.enum(["inline", "env", "file"]).default("inline"),
  keyEnvName: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "env name: CAPITAL_LETTERS_AND_UNDERSCORES")
    .optional(),
  keyFile: z.string().trim().max(512).optional(),
  headers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(128),
        value: z.string().max(4096),
      })
    )
    .max(20)
    .default([]),
  // Optional cheap model for titles etc. Blank = leave existing untouched.
  small_model: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z
      .string()
      .trim()
      .max(256)
      .refine((v) => v.includes("/"), "small_model must look like provider/model")
      .optional()
  ),
  tool_call: z.coerce.boolean().default(true),
  reasoning: z.coerce.boolean().default(false),
  attachment: z.coerce.boolean().default(false),
});

export type ProviderInput = z.infer<typeof providerSchema>;

export type ProviderSummary = {
  id: string;
  name: string | null;
  baseURL: string | null;
  hasKey: boolean;
  /** Non-secret description of how the key is stored, if it is a reference. */
  keyRef: { kind: "env" | "file"; name: string } | null;
  /** Names of custom request headers (values never leave the server). */
  headerNames: string[];
  models: Array<{
    id: string;
    name: string | null;
    tool_call: boolean;
    reasoning: boolean;
    attachment: boolean;
    interleaved: string | null;
    limit: { context?: number; output?: number } | null;
  }>;
};

export type FieldErrors = Partial<
  Record<
    | "base_url"
    | "api_key"
    | "model_id"
    | "providerId"
    | "context_limit"
    | "output_limit"
    | "small_model"
    | "_form",
    string
  >
>;

/** Collapse a zod SafeParse result to first-message-per-field. */
export function toFieldErrors(
  result: ReturnType<typeof providerSchema.safeParse>
): FieldErrors {
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = (issue.path[0]?.toString() ?? "_form") as keyof FieldErrors;
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
