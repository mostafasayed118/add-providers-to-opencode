import { NextResponse } from "next/server";
import { getGlobalConfigPath, readHistory } from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      entries: await readHistory(getGlobalConfigPath()),
    });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Could not read history." } },
      { status: 500 }
    );
  }
}
