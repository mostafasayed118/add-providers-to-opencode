import { NextResponse } from "next/server";
import { logHistory, setProviderGate, type GateState } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import { asProviderId, isSameOrigin, safeTargetError } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const STATES: GateState[] = ["auto", "enabled", "disabled"];

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
  const { providerId, state } = (body ?? {}) as { providerId?: unknown; state?: unknown };
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
  if (state !== "auto" && state !== "enabled" && state !== "disabled") {
    return NextResponse.json(
      { ok: false, errors: { _form: `state must be one of ${STATES.join(", ")}.` } },
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
    await setProviderGate(configPath, nid, state);
    await logHistory(configPath, "save", {
      provider: nid,
      model: `gate:${state}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, state });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update gate.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Failed to update gate." : msg;
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: safe },
      },
      { status: 500 }
    );
  }
}
