import { NextResponse } from "next/server";
import { getGlobalConfigPath, listProviders } from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const configPath = getGlobalConfigPath();
  try {
    const { promises: fs } = await import("node:fs");
    let model: string | null = null;
    let exists = true;
    try {
      const raw = await fs.readFile(configPath, "utf8");
      const parsed = JSON.parse(raw) as { model?: unknown };
      model = typeof parsed.model === "string" ? parsed.model : null;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        exists = false;
      } else {
        throw err;
      }
    }
    const providers = exists ? await listProviders(configPath) : [];
    return NextResponse.json({
      ok: true,
      exists,
      path: configPath,
      model,
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
