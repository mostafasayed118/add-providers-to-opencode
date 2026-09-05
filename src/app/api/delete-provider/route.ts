import { NextResponse } from "next/server";
import { deleteProvider, logHistory } from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
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
  try {
    let configPath: string;
    try {
      configPath = await configPathFromBody(body);
    } catch (err: unknown) {
      return NextResponse.json(
        { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
        { status: 400 }
      );
    }
    const result = await deleteProvider(configPath, providerId.trim());
    await logHistory(configPath, "delete", {
      provider: providerId.trim().toLowerCase(),
      model: result.newModel,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: err instanceof Error ? err.message : "Failed to delete provider.",
        },
      },
      { status: 500 }
    );
  }
}
