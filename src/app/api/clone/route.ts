import { NextResponse } from "next/server";
import { cloneProvider, logHistory } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";

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
  const providerId = (body as { providerId?: unknown })?.providerId;
  if (typeof providerId !== "string" || !providerId.trim()) {
    return NextResponse.json(
      { ok: false, errors: { _form: "providerId is required." } },
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
    const result = await cloneProvider(configPath, providerId);
    await logHistory(configPath, "clone", {
      provider: providerId.trim().toLowerCase(),
      model: result.newId,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Clone failed." },
      },
      { status: 500 }
    );
  }
}
