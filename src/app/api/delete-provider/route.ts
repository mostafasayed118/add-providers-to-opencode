import { NextResponse } from "next/server";
import { deleteProvider, logHistory } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { asProviderId, isSameOrigin, safeTargetError } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
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
    const result = await deleteProvider(configPath, nid);
    await logHistory(configPath, "delete", {
      provider: nid,
      model: result.newModel,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete provider.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Failed to delete provider." : msg;
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
