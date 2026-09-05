import { NextResponse } from "next/server";
import { readHistory } from "@/lib/opencode-config";
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
      entries: await readHistory(configPath),
    });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Could not read history." } },
      { status: 500 }
    );
  }
}
