import { NextResponse } from "next/server";
import { cloneProvider, logHistory } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { asProviderId, isSameOrigin, safeTargetError } from "@/lib/request-guard";

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
  const providerId = (body as { providerId?: unknown })?.providerId;
  if (typeof providerId !== "string" || !providerId.trim()) {
    return NextResponse.json(
      { ok: false, errors: { _form: "providerId is required." } },
      { status: 400 }
    );
  }
  const nid = asProviderId(providerId);
  if (!nid) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Invalid provider id." } },
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
    const result = await cloneProvider(configPath, nid);
    await logHistory(configPath, "clone", {
      provider: nid,
      model: result.newId,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Clone failed.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Clone failed." : msg;
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: safe },
      },
      { status: 500 }
    );
  }
}
