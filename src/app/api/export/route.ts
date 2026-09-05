import { NextResponse } from "next/server";
import {
  getGlobalConfigPath,
  readExistingConfig,
  redactSecrets,
} from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

/**
 * Downloadable provider pack. Secrets are redacted, so the file is safe to
 * move between machines — but keys must be re-entered on import.
 */
export async function GET() {
  try {
    const existing = await readExistingConfig(getGlobalConfigPath());
    const providers = ((existing.provider as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const clean: Record<string, unknown> = {};
    for (const [pid, p] of Object.entries(providers)) {
      clean[pid] = {
        npm: "@ai-sdk/openai-compatible",
        ...(p ?? {}),
      };
    }
    return NextResponse.json({
      ok: true,
      pack: { providers: redactSecrets(clean) },
      redacted: true,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Export failed." },
      },
      { status: 500 }
    );
  }
}
