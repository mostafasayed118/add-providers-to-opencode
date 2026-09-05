import { NextResponse } from "next/server";
import { diffJson } from "@/lib/diff";
import {
  readExistingConfig,
  redactSecrets,
} from "@/lib/opencode-config";
import { configPathFromBody } from "@/lib/route-target";
import type { PreviewSection } from "../preview/route";
export const dynamic = "force-dynamic";

const BACKUP_NAME = /^opencode\.json\.(bak\.\d+|corrupt-\d+)$/;

/** Dry-run of restore: diff a backup against the live file. Writes nothing. */
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
  const file = (body as { file?: unknown })?.file;
  if (typeof file !== "string" || !BACKUP_NAME.test(file)) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Unrecognized backup file." } },
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
    const { promises: fs } = await import("node:fs");
    const { default: path } = await import("node:path");
    const raw = await fs.readFile(path.join(path.dirname(configPath), file), "utf8");
    const backup = JSON.parse(raw) as Record<string, unknown>;
    const live = await readExistingConfig(configPath).catch(() => ({}));
    const sections: PreviewSection[] = [
      {
        title: "provider (full map)",
        lines: diffJson(
          redactSecrets((live as Record<string, unknown>).provider ?? null),
          redactSecrets((backup as Record<string, unknown>).provider ?? null)
        ),
      },
      {
        title: "top-level model",
        lines: diffJson(
          (live as { model?: unknown }).model ?? null,
          (backup as { model?: unknown }).model ?? null
        ),
      },
    ];
    const changed = sections.some((s) => s.lines.some((l) => l.type !== "same"));
    return NextResponse.json({ ok: true, file, changed, sections });
  } catch {
    return NextResponse.json(
      { ok: false, errors: { _form: "Backup is unreadable." } },
      { status: 500 }
    );
  }
}
