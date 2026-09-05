import { NextResponse } from "next/server";
import { deleteProvider, getGlobalConfigPath } from "@/lib/opencode-config";

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
    const result = await deleteProvider(getGlobalConfigPath(), providerId.trim());
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
