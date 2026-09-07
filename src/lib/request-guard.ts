// Minimal same-origin + input guards for mutating routes.
// No Node imports: safe to import from any route.
export const PROVIDER_ID_RE = /^[a-z0-9-]{1,32}$/;
export const MODEL_ID_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
export const BACKUP_NAME_RE = /^opencode\.json\.(bak\.\d+|corrupt-\d+)$/;
export const KEY_FILE_RE = /^[A-Za-z0-9._\-/\\:]+$/;
export const MAX_API_KEY_LEN = 8192;
export const MAX_URL_LEN = 2048;

export function slice100(s: string): string {
  return s.slice(0, 100);
}

export function asProviderId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  return PROVIDER_ID_RE.test(id) ? id : null;
}

export function isValidModelId(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  return s.length >= 1 && s.length <= 128 && MODEL_ID_RE.test(s);
}

/** Minimal keyFile path check: reject empty, traversal, bad chars, too long. */
export function keyFileError(raw: unknown): string | null {
  if (typeof raw !== "string") return "Choose a file path to store the key in.";
  const file = raw.trim();
  if (!file) return "Choose a file path to store the key in.";
  if (file.length > 512) return "Key file path is too long.";
  if (file.includes("..")) return "Key file path must not contain '..'.";
  if (!KEY_FILE_RE.test(file)) return "Key file path contains invalid characters.";
  return null;
}

/**
 * Same-origin guard for mutating routes.
 * Allows missing Origin/Referer (same-origin fetch, Electron).
 * Returns false when Origin/Referer host mismatches request Host.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host") ?? safeHostFromUrl(req.url);
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return false;
      return true;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host !== host) return false;
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Map target-resolution errors to a generic message when they echo paths. */
export function safeTargetError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Bad target.";
  if (msg.includes("/") || msg.includes("\\")) return "Invalid target.";
  return msg;
}
