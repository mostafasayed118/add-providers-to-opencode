import { NextResponse } from "next/server";
import {
  checkConfig,
  deleteProvider,
  getGlobalConfigPath,
  logHistory,
  readExistingConfig,
} from "@/lib/opencode-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const existing = await readExistingConfig(getGlobalConfigPath());
    return NextResponse.json({ ok: true, issues: checkConfig(existing) });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: err instanceof Error ? err.message : "Could not check config.",
        },
      },
      { status: 500 }
    );
  }
}

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
  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "string") {
    return NextResponse.json(
      { ok: false, errors: { _form: "id is required." } },
      { status: 400 }
    );
  }
  try {
    const configPath = getGlobalConfigPath();
    if (id === "dangling-model") {
      // Repoint the active model at the first available provider/model.
      const existing = await readExistingConfig(configPath);
      const providers =
        ((existing.provider as Record<string, unknown> | undefined) ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
      for (const [pid, p] of Object.entries(providers)) {
        const models = ((p.models ?? {}) as Record<string, unknown>) ?? {};
        const first = Object.keys(models)[0];
        if (first) {
          const { withConfigLock } = await import("@/lib/opencode-config");
          await withConfigLock(configPath, async () => {
            const { promises: fs } = await import("node:fs");
            const cur = await readExistingConfig(configPath);
            const tmp = `${configPath}.tmp.${process.pid}.${Date.now()}`;
            await fs.copyFile(configPath, `${configPath}.bak.${Date.now()}`).catch(() => {});
            await fs.writeFile(
              tmp,
              JSON.stringify({ ...cur, model: `${pid}/${first}` }, null, 2) + "\n",
              "utf8"
            );
            await fs.rename(tmp, configPath);
          });
          await logHistory(configPath, "save", { provider: pid, model: `${pid}/${first}` });
          return NextResponse.json({ ok: true, fixed: `${pid}/${first}` });
        }
      }
      return NextResponse.json(
        { ok: false, errors: { _form: "No provider with models exists to point at." } },
        { status: 400 }
      );
    }
    if (id.startsWith("empty:")) {
      const pid = id.slice("empty:".length);
      const res = await deleteProvider(configPath, pid);
      await logHistory(configPath, "delete", { provider: pid, model: res.newModel });
      return NextResponse.json({ ok: true, fixed: `removed ${pid}` });
    }
    return NextResponse.json(
      { ok: false, errors: { _form: "This issue has no automatic fix." } },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: err instanceof Error ? err.message : "Fix failed." },
      },
      { status: 500 }
    );
  }
}
