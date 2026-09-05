import { NextResponse } from "next/server";
import {
  deleteManyProviders,
  getGlobalConfigPath,
  logHistory,
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
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { ok: false, errors: { _form: "ids must be an array of provider id strings." } },
      { status: 400 }
    );
  }
  try {
    const configPath = getGlobalConfigPath();
    const result = await deleteManyProviders(configPath, ids);
    await logHistory(configPath, "delete", {
      provider: ids.join(","),
      model: result.newModel,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result, deleted: ids.length });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Bulk delete failed." },
      },
      { status: 500 }
    );
  }
}
