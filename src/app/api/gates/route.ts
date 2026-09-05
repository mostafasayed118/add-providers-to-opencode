import { NextResponse } from "next/server";
import { logHistory, setProviderGate, type GateState } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";

export const dynamic = "force-dynamic";

const STATES: GateState[] = ["auto", "enabled", "disabled"];

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
  const { providerId, state } = (body ?? {}) as { providerId?: unknown; state?: unknown };
  if (typeof providerId !== "string" || !providerId.trim()) {
    return NextResponse.json(
      { ok: false, errors: { _form: "providerId is required." } },
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
      { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
      { status: 400 }
    );
  }
  try {
    await setProviderGate(configPath, providerId, state);
    await logHistory(configPath, "save", {
      provider: providerId.trim().toLowerCase(),
      model: `gate:${state}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, state });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Failed to update gate." },
      },
      { status: 500 }
    );
  }
}
