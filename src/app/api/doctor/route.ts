import { NextResponse } from "next/server";
import {
  checkConfig,
  deleteProvider,
  logHistory,
  readExistingConfig,
} from "@/lib/opencode-config";
import { configPathFromBody, configPathFromQuery } from "@/lib/route-target";
import { asProviderId, isSameOrigin, safeTargetError, slice100 } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let configPath: string;
  try {
    configPath = await configPathFromQuery(req);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, errors: { _form: safeTargetError(err) } },
      { status: 400 }
    );
  }
  try {
    const existing = await readExistingConfig(configPath);
    return NextResponse.json({ ok: true, issues: checkConfig(existing) });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          _form: "Could not check config.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Forbidden." } },
      { status: 403 }
    );
  }
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
  const shortId = slice100(id);
  if (id !== "dangling-model" && !id.startsWith("empty:")) {
    return NextResponse.json(
      { ok: false, errors: { _form: "This issue has no automatic fix." } },
      { status: 400 }
    );
  }
  if (id.startsWith("empty:")) {
    const rawPid = id.slice("empty:".length);
    if (!asProviderId(rawPid)) {
      return NextResponse.json(
        { ok: false, errors: { _form: `Invalid provider id "${shortId}".` } },
        { status: 400 }
      );
    }
  }
  try {
    let configPath: string;
    try {
      configPath = await configPathFromBody(body);
    } catch (err: unknown) {
      return NextResponse.json(
        { ok: false, errors: { _form: safeTargetError(err) } },
        { status: 400 }
      );
    }
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
      const pid = id.slice("empty:".length).trim().toLowerCase();
      const res = await deleteProvider(configPath, pid);
      await logHistory(configPath, "delete", { provider: pid, model: res.newModel });
      return NextResponse.json({ ok: true, fixed: `removed ${slice100(pid)}` });
    }
    return NextResponse.json(
      { ok: false, errors: { _form: "This issue has no automatic fix." } },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Fix failed.";
    const safe = msg.includes("/") || msg.includes("\\") ? "Fix failed." : msg;
    return NextResponse.json(
      {
        ok: false,
        errors: { _form: safe },
      },
      { status: 500 }
    );
  }
}
