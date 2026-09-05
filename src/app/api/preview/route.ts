import { NextResponse } from "next/server";
import {
  mergeProviderEntry,
  providerSchema,
  readExistingConfig,
  redactSecrets,
} from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { diffJson, type DiffLine } from "@/lib/diff";

export const dynamic = "force-dynamic";

export type PreviewSection = { title: string; lines: DiffLine[] };

/**
 * Dry-run of save: validates the payload and returns the exact JSON diff
 * that submitting would apply. Writes nothing.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }
  const raw = { ...((body ?? {}) as Record<string, unknown>) };
  let configPath: string;
  try {
    configPath = await configPathFromBody(raw);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
      { status: 400 }
    );
  }

  // Same blank-key rule as save: reuse the stored key when editing.
  if (typeof raw.api_key !== "string" || raw.api_key.trim() === "") {
    const { getStoredApiKey } = await import("@/lib/opencode-config");
    const effId =
      raw.providerType === "openai-compatible"
        ? "custom"
        : typeof raw.providerId === "string" && raw.providerId.trim()
          ? raw.providerId.trim().toLowerCase()
          : "custom";
    const stored = await getStoredApiKey(configPath, effId).catch(() => null);
    if (stored) raw.api_key = stored;
  }

  const parsed = providerSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }
  if (!parsed.data.api_key) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          api_key: "api_key is required for a new provider (or pick one that already has a key).",
        },
      },
      { status: 400 }
    );
  }

  try {
    const existing = await readExistingConfig(configPath);
    const merged = mergeProviderEntry(existing, {
      ...parsed.data,
      api_key: parsed.data.api_key,
    });
    const existingProviders =
      (existing.provider as Record<string, unknown> | undefined) ?? {};
    const sections: PreviewSection[] = [
      {
        title: `provider.${merged.providerId}`,
        // Redact first: the browser already holds what the user typed, but
        // must never receive stored secrets from a blank-key edit.
        lines: diffJson(
          redactSecrets(existingProviders[merged.providerId] ?? null),
          redactSecrets(merged.entry)
        ),
      },
    ];
    const oldModel = (existing as { model?: unknown }).model ?? null;
    if (oldModel !== merged.model) {
      sections.push({ title: "top-level model", lines: diffJson(oldModel, merged.model) });
    }
    if (parsed.data.small_model) {
      const oldSmall = (existing as { small_model?: unknown }).small_model ?? null;
      if (oldSmall !== parsed.data.small_model) {
        sections.push({
          title: "top-level small_model",
          lines: diffJson(oldSmall, parsed.data.small_model),
        });
      }
    }
    const changed = sections.some((s) => s.lines.some((l) => l.type !== "same"));
    return NextResponse.json({ ok: true, model: merged.model, changed, sections });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: err instanceof Error ? err.message : "Could not build preview.",
        },
      },
      { status: 500 }
    );
  }
}
