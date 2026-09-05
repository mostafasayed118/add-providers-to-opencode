import { NextResponse } from "next/server";
import { getGlobalConfigPath, listBackups } from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      backups: await listBackups(getGlobalConfigPath()),
    });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Could not list backups." } },
      { status: 500 }
    );
  }
}
