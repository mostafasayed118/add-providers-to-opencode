import { NextResponse } from "next/server";
import {
  getGlobalConfigPath,
  getStoredApiKey,
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
  // Blank key on an existing provider = keep the stored key.
  if (typeof raw.api_key !== "string" || raw.api_key.trim() === "") {
    const effId =
      raw.providerType === "openai-compatible"
        ? "custom"
        : typeof raw.providerId === "string" && raw.providerId.trim()
          ? raw.providerId.trim().toLowerCase()
          : "custom";
    const stored = await getStoredApiKey(getGlobalConfigPath(), effId).catch(
      () => null
    );
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
    return NextResponse.json({ ok: true, ...result });
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
