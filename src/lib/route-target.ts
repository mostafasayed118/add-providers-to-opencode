import { resolveConfigPath } from "./opencode-config";

/** POST/DELETE bodies carry an optional `target` ({kind:'global'|'project'|'custom',...}). */
export async function configPathFromBody(body: unknown): Promise<string> {
  return resolveConfigPath((body as { target?: unknown })?.target);
}

/** GET routes carry it as `?t=<url-encoded JSON>`. */
export async function configPathFromQuery(req: Request): Promise<string> {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) return resolveConfigPath(undefined);
  let target: unknown;
  try {
    target = JSON.parse(t);
  } catch {
    throw new Error("Bad target parameter.");
  }
  return resolveConfigPath(target);
}
