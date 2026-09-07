import { NextResponse } from "next/server";
import { deleteManyProviders, logHistory } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { asProviderId, isSameOrigin, safeTargetError, slice100 } from "@/lib/request-guard";

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
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { ok: false, errors: { _form: "ids must be an array of provider id strings." } },
      { status: 400 }
    );
  }
  const normalized: string[] = [];
  for (const rawId of ids as string[]) {
    const nid = asProviderId(rawId);
    if (!nid) {
      return NextResponse.json(
        { ok: false, errors: { _form: `Invalid provider id "${slice100(String(rawId))}".` } },
        { status: 400 }
      );
    }
    normalized.push(nid);
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
    const result = await deleteManyProviders(configPath, normalized);
    await logHistory(configPath, "delete", {
      provider: normalized.join(",").slice(0, 200),
      model: result.newModel,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result, deleted: normalized.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bulk delete failed.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Bulk delete failed." : msg.slice(0, 200);
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: safe },
      },
      { status: 500 }
    );
  }
}
