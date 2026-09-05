import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import {
  configMtimeMs,
  getGlobalConfigPath,
  getProviderGates,
  listProviders,
} from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const configPath = getGlobalConfigPath();
  try {
    let model: string | null = null;
    let smallModel: string | null = null;
    let exists = true;
    let gates = { enabled: [] as string[], disabled: [] as string[] };
    try {
      // Raw read on purpose: a GET must never repair or back up the file.
      const raw = await fs.readFile(configPath, "utf8");
      const parsed = (raw.trim() ? JSON.parse(raw) : {}) as Record<string, unknown>;
      if (typeof parsed.model === "string") model = parsed.model;
      if (typeof parsed.small_model === "string") smallModel = parsed.small_model;
      gates = getProviderGates(parsed);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        exists = false;
      } else {
        return NextResponse.json(
          { ok: false, errors: { _form: "Existing opencode.json is not valid JSON." } },
          { status: 500 }
        );
      }
    }
    const providers = exists ? await listProviders(configPath) : [];
    return NextResponse.json({
      ok: true,
      exists,
      path: configPath,
      model,
      smallModel,
      mtimeMs: await configMtimeMs(configPath),
      gates,
      providerIds: providers.map((p) => p.id),
      providers,
    });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Could not read current configuration." } },
      { status: 500 }
    );
  }
}
