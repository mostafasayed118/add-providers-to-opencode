import { NextResponse } from "next/server";
import { logHistory, restoreBackup } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { BACKUP_NAME_RE, isSameOrigin, safeTargetError } from "@/lib/request-guard";

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
  const file = (body as { file?: unknown })?.file;
  if (typeof file !== "string" || !BACKUP_NAME_RE.test(file)) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Unrecognized backup file." } },
      { status: 400 }
    );
  }
  try {
    let configPath: string;
    try {
      configPath = await configPathFromBody(body);
    } catch (err: unknown) {
      return NextResponse.json(
        { ok: false, errors: { _form: safeTargetError(err) } },
        { status: 400 }
      );
    }
    const result = await restoreBackup(configPath, file);
    await logHistory(configPath, "restore", { provider: null, model: result.model }).catch(
      () => {}
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Restore failed.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Restore failed." : msg;
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: safe,
        },
      },
      { status: 500 }
    );
  }
}
