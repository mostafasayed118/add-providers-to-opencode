import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import {
  configMtimeMs,
  getProviderGates,
  listProvidersFromExisting,
} from "@/lib/opencode-config";
import { configPathFromQuery } from "@/lib/route-target";

export const dynamic = "force-dynamic";

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
    let model: string | null = null;
    let smallModel: string | null = null;
    let exists = true;
    let gates = { enabled: [] as string[], disabled: [] as string[] };
    let parsed: Record<string, unknown> | null = null;
    try {
      // Raw read on purpose: a GET must never repair or back up the file.
      const raw = await fs.readFile(configPath, "utf8");
      parsed = (raw.trim() ? JSON.parse(raw) : {}) as Record<string, unknown>;
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
    // Reuse the single parsed read instead of a second fs.readFile in listProviders.
    const providers = exists && parsed ? listProvidersFromExisting(parsed) : [];
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
