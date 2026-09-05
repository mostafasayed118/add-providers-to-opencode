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
  models: Array<{
    id: string;
    name: string | null;
    tool_call: boolean;
    reasoning: boolean;
    attachment: boolean;
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
