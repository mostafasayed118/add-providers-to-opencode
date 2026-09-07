import { NextResponse } from "next/server";
import {
  importPack,
  logHistory,
  validatePack,
} from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { isSameOrigin, safeTargetError } from "@/lib/request-guard";

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
      { ok: false, errors: { _form: "File is not valid JSON." } },
      { status: 400 }
    );
  }
  const checked = validatePack((body as { pack?: unknown })?.pack ?? body);
  if (!checked.ok) {
    return NextResponse.json(
      { ok: false, errors: { _form: checked.error } },
      { status: 400 }
    );
  }
  let configPath: string;
  try {
    configPath = await configPathFromBody(body);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: safeTargetError(err) } },
      { status: 400 }
    );
  }
  try {
    const result = await importPack(configPath, checked.pack);
    await logHistory(configPath, "save", {
      provider: result.imported.join(",").slice(0, 200),
      model: `import:${result.imported.length}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: "Import failed." },
      },
      { status: 500 }
    );
  }
}
