import { NextResponse } from "next/server";
import {
  getGlobalConfigPath,
  getStoredApiKey,
  getStoredHeaders,
  writeKeyFile,
  providerSchema,
  saveProviderConfig,
} from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

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
  const effId =
    raw.providerType === "openai-compatible"
      ? "custom"
      : typeof raw.providerId === "string" && raw.providerId.trim()
        ? raw.providerId.trim().toLowerCase()
        : "custom";
  const configPath = getGlobalConfigPath();
  const keyGiven = typeof raw.api_key === "string" && raw.api_key.trim() !== "";
  let notice: string | null = null;

  // Merge custom headers: blank value on a stored name keeps the stored
  // secret; blank value on a new name is rejected.
  if (Array.isArray(raw.headers)) {
    const stored: Record<string, string> = await getStoredHeaders(configPath, effId).catch(
      () => ({})
    );
    const merged: Array<{ name: string; value: string }> = [];
    for (const row of raw.headers as Array<{ name?: unknown; value?: unknown }>) {
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      if (!name) continue;
      const value = typeof row?.value === "string" ? row.value : "";
      if (value.trim() !== "") {
        merged.push({ name, value });
      } else if (stored[name] !== undefined) {
        merged.push({ name, value: stored[name] });
      } else {
        return NextResponse.json(
          { ok: false, errors: { _form: `Header "${name}" needs a value (or pick a stored one).` } },
          { status: 400 }
        );
      }
    }
    raw.headers = merged;
  }

  const storage = raw.keyStorage === "env" || raw.keyStorage === "file" ? raw.keyStorage : "inline";
  if (!keyGiven) {
    // Blank key on an existing provider = keep the stored key/reference.
    const stored = await getStoredApiKey(configPath, effId).catch(() => null);
    if (stored) {
      raw.api_key = stored;
    } else {
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
  } else if (storage === "env") {
    const name = typeof raw.keyEnvName === "string" ? raw.keyEnvName.trim() : "";
    if (!name) {
      return NextResponse.json(
        { ok: false, errors: { _form: "Choose an env var name to store the key in." } },
        { status: 400 }
      );
    }
    raw.api_key = `{env:${name}}`;
    notice = `Key stored as reference only. Set ${name} in your environment before running opencode, otherwise requests will fail with an empty key.`;
  } else if (storage === "file") {
    const file = typeof raw.keyFile === "string" ? raw.keyFile.trim() : "";
    if (!file) {
      return NextResponse.json(
        { ok: false, errors: { _form: "Choose a file path to store the key in." } },
        { status: 400 }
      );
    }
    try {
      await writeKeyFile(file, (raw.api_key as string).trim());
    } catch {
      return NextResponse.json(
        { ok: false, errors: { _form: `Could not write the key file at ${file}.` } },
        { status: 500 }
      );
    }
    raw.api_key = `{file:${file}}`;
    notice = `Key written to ${file} (owner-only permissions). The config holds a reference, not the secret.`;
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

  try {
    const result = await saveProviderConfig(parsed.data);
    return NextResponse.json({ ok: true, ...result, notice });
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { message?: string };
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      return NextResponse.json(
        {
          ok: false,
          errors: {
            _form:
              "Permission denied writing global opencode.json. Run as a user with home-directory write access.",
          },
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, errors: { _form: e?.message ?? "Failed to save configuration." } },
      { status: 500 }
    );
  }
}
