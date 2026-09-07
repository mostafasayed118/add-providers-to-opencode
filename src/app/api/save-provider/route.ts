import { NextResponse } from "next/server";
import {
  getStoredApiKey,
  getStoredHeaders,
  logHistory,
  writeKeyFile,
  providerSchema,
  saveProviderConfig,
} from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { isSameOrigin, keyFileError, safeTargetError } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Forbidden." } },
      { status: 403 }
    );
  }
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
      { ok: false, errors: { _form: safeTargetError(err) } },
      { status: 400 }
    );
  }
  const effId =
    raw.providerType === "openai-compatible"
      ? "custom"
      : typeof raw.providerId === "string" && raw.providerId.trim()
        ? raw.providerId.trim().toLowerCase()
        : "custom";
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
          { ok: false, errors: { _form: `Header "${name.slice(0, 100)}" needs a value (or pick a stored one).` } },
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
  } else if (storage === "file") {
    // Validate keyFile path before any filesystem side effect.
    const kfErr = keyFileError(raw.keyFile);
    if (kfErr) {
      return NextResponse.json(
        { ok: false, errors: { _form: kfErr } },
        { status: 400 }
      );
    }
    // Validate the rest of the payload before writing the key file so a
    // bad base_url/model_id never leaves a secret file behind.
    const early = providerSchema.safeParse(raw);
    if (!early.success) {
      const errors: Record<string, string> = {};
      for (const issue of early.error.issues) {
        const key = issue.path[0]?.toString() ?? "_form";
        if (!errors[key]) errors[key] = issue.message;
      }
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }
  } else if (storage === "env") {
    const name = typeof raw.keyEnvName === "string" ? raw.keyEnvName.trim() : "";
    if (!name) {
      return NextResponse.json(
        { ok: false, errors: { _form: "Choose an env var name to store the key in." } },
        { status: 400 }
      );
    }
    // Validate before transforming to a reference.
    const early = providerSchema.safeParse(raw);
    if (!early.success) {
      const errors: Record<string, string> = {};
      for (const issue of early.error.issues) {
        const key = issue.path[0]?.toString() ?? "_form";
        if (!errors[key]) errors[key] = issue.message;
      }
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }
    raw.api_key = `{env:${name}}`;
    notice = `Key stored as reference only. Set ${name.slice(0, 100)} in your environment before running opencode, otherwise requests will fail with an empty key.`;
  }
  if (keyGiven && storage === "file") {
    const file = (raw.keyFile as string).trim();
    try {
      await writeKeyFile(file, (raw.api_key as string).trim());
    } catch {
      return NextResponse.json(
        { ok: false, errors: { _form: "Could not write the key file." } },
        { status: 500 }
      );
    }
    raw.api_key = `{file:${file}}`;
    notice = `Key written to file (owner-only permissions). The config holds a reference, not the secret.`;
  } else if (keyGiven && storage === "env" && typeof raw.api_key === "string" && !raw.api_key.startsWith("{env:")) {
    const name = typeof raw.keyEnvName === "string" ? raw.keyEnvName.trim() : "";
    raw.api_key = `{env:${name}}`;
    notice = `Key stored as reference only. Set ${name.slice(0, 100)} in your environment before running opencode, otherwise requests will fail with an empty key.`;
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
    const result = await saveProviderConfig(parsed.data, configPath);
    await logHistory(configPath, "save", {
      provider: effId,
      model: result.model,
    }).catch(() => {});
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
      { ok: false, errors: { _form: "Failed to save configuration." } },
      { status: 500 }
    );
  }
}
