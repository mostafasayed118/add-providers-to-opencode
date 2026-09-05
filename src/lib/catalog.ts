import { isAllowedUrl } from "./provider-schema";

export const PROBE_TIMEOUT_MS = 15_000;

export type ProbeResult =
  | { ok: true; models: string[]; count: number }
  | { ok: false; error: string };

/** GET {baseURL}/models with optional bearer auth. Pure fetch, no fs. */
export async function probeModels(baseUrl: string, apiKey?: string): Promise<ProbeResult> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  try {
    new URL(base);
  } catch {
    return { ok: false, error: "base_url is not a valid URL." };
  }
  if (!isAllowedUrl(base)) {
    return { ok: false, error: "base_url must use https, except localhost / private LAN." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    const res = await fetch(`${base}/models`, { headers, signal: ctrl.signal });
    if (!res.ok) {
      return { ok: false, error: `Endpoint answered HTTP ${res.status}. Check the URL and key.` };
    }
    const data = (await res.json()) as { data?: unknown };
    const models = Array.isArray(data?.data)
      ? (data.data as Array<{ id?: unknown }>)
          .map((m) => m?.id)
          .filter((id): id is string => typeof id === "string")
          .slice(0, 100)
      : [];
    return { ok: true, models, count: models.length };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "AbortError"
          ? `No answer within ${PROBE_TIMEOUT_MS / 1000}s. Check the URL.`
          : "Could not reach the endpoint. Check the URL (and network).",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type CatalogModel = {
  id: string;
  context?: number;
  output?: number;
  imageInput?: boolean;
};

export type Catalog = { models: CatalogModel[] };

/**
 * Normalize the many shapes a model catalog can take into a flat list.
 * Accepts models.dev-style dumps ({id, limit:{context,output}, modalities:{input:[]}})
 * as well as OpenAI /v1/models lists ({id} only).
 */
export function normalizeCatalog(raw: unknown): CatalogModel[] {
  const out: CatalogModel[] = [];
  const push = (id: unknown, ctx?: unknown, outp?: unknown, inputs?: unknown) => {
    if (typeof id !== "string" || !id) return;
    const m: CatalogModel = { id };
    if (typeof ctx === "number" && ctx > 0) m.context = ctx;
    if (typeof outp === "number" && outp > 0) m.output = outp;
    if (Array.isArray(inputs) && inputs.includes("image")) m.imageInput = true;
    out.push(m);
  };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && (o.limit !== undefined || o.modalities !== undefined || o.data === undefined)) {
      const limit = (o.limit ?? {}) as { context?: unknown; output?: unknown };
      const mod = (o.modalities ?? {}) as { input?: unknown };
      push(o.id, limit.context, limit.output, mod.input);
    }
    if (Array.isArray(o.data)) {
      // OpenAI envelope or provider-grouped maps.
      for (const x of o.data) visit(x);
      return;
    }
    for (const v of Object.values(o)) {
      if (v !== null && typeof v === "object") visit(v);
    }
  };
  visit(raw);
  const seen = new Set<string>();
  return out.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** Best-effort match of a user-typed model id against the catalog. */
export function matchCatalogModel(catalog: CatalogModel[], query: string): CatalogModel | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const exact = catalog.find((m) => m.id.toLowerCase() === q);
  if (exact) return exact;
  const ends = catalog.filter(
    (m) => m.id.toLowerCase() === q || m.id.toLowerCase().endsWith(`/${q}`)
  );
  if (ends.length === 1) return ends[0];
  if (ends.length > 1) {
    return ends.find((m) => m.context !== undefined) ?? ends[0];
  }
  const contains = catalog.filter((m) => m.id.toLowerCase().includes(q));
  if (contains.length === 1) return contains[0];
  return null;
}

let catalogCache: { at: number; models: CatalogModel[] } | null = null;
const CATALOG_TTL_MS = 60 * 60 * 1000;

/** Fetch + cache the models.dev catalog (multi-MB dump, so cache for an hour). */
export async function fetchCatalog(): Promise<CatalogModel[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.models;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch("https://models.dev/api.json", { signal: ctrl.signal });
    if (!res.ok) throw new Error(`models.dev answered HTTP ${res.status}`);
    const models = normalizeCatalog(await res.json());
    catalogCache = { at: Date.now(), models };
    return models;
  } finally {
    clearTimeout(timer);
  }
}
