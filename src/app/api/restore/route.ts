import { NextResponse } from "next/server";
import { getGlobalConfigPath, logHistory, restoreBackup } from "@/lib/opencode-config";

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
  const file = (body as { file?: unknown })?.file;
  if (typeof file !== "string" || !file) {
    return NextResponse.json(
      { ok: false, errors: { _form: "file is required." } },
      { status: 400 }
    );
  }
  try {
    const configPath = getGlobalConfigPath();
    const result = await restoreBackup(configPath, file);
    await logHistory(configPath, "restore", { provider: null, model: result.model }).catch(
      () => {}
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: err instanceof Error ? err.message : "Restore failed.",
        },
      },
      { status: 500 }
    );
  }
}
