import { NextResponse } from "next/server";
import {
  readExistingConfig,
  redactSecrets,
} from "@/lib/opencode-config";
import { configPathFromQuery } from "@/lib/route-target";

export const dynamic = "force-dynamic";

/**
 * Downloadable provider pack. Secrets are redacted, so the file is safe to
 * move between machines — but keys must be re-entered on import.
 */
export async function GET(req: Request) {
  let configPath: string;
  try {
    configPath = await configPathFromQuery(req);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
      { status: 400 }
    );
  }
  try {
    const existing = await readExistingConfig(configPath);
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
