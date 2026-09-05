import { NextResponse } from "next/server";
import { listBackups } from "@/lib/opencode-config";
import { configPathFromQuery } from "@/lib/route-target";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let configPath: string;
  try {
    configPath = await configPathFromQuery(req);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: err instanceof Error ? err.message : "Bad target." } },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      backups: await listBackups(configPath),
    });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Could not list backups." } },
      { status: 500 }
    );
  }
}
