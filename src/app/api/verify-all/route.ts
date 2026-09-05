import { NextResponse } from "next/server";
import { probeModels } from "@/lib/catalog";
import { readExistingConfig } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";

export const dynamic = "force-dynamic";

export type VerifyRow = {
  id: string;
  ok: boolean;
  count?: number;
  error?: string;
};

/** Probe every configured provider's /models endpoint and report pass/fail. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  let configPath: string;
  try {
    configPath = await configPathFromBody(body);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
      { status: 400 }
    );
  }
  try {
    const existing: Record<string, unknown> = await readExistingConfig(configPath).catch(
      () => ({})
    );
    const providers = ((existing.provider as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const rows = await Promise.all(
      Object.entries(providers).map(async ([id, p]): Promise<VerifyRow> => {
        const options = ((p.options ?? {}) as Record<string, unknown>) ?? {};
        if (typeof options.baseURL !== "string" || !options.baseURL) {
          return { id, ok: false, error: "No baseURL configured." };
        }
        const r = await probeModels(
          options.baseURL,
          typeof options.apiKey === "string" ? options.apiKey : undefined
        );
        return r.ok ? { id, ok: true, count: r.count } : { id, ok: false, error: r.error };
      })
    );
    const passed = rows.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, passed, total: rows.length, rows });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Verify-all failed." },
      },
      { status: 500 }
    );
  }
}
