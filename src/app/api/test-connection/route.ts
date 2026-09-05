import { NextResponse } from "next/server";
import { isAllowedUrl } from "@/lib/provider-schema";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 15_000;

/** Probe `{baseURL}/models` so typos fail fast in the form. Never stores anything. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  const { base_url, api_key } = (body ?? {}) as {
    base_url?: unknown;
    api_key?: unknown;
  };
  if (typeof base_url !== "string" || !base_url.trim()) {
    return NextResponse.json(
      { ok: false, error: "Enter a base_url first." },
      { status: 400 }
    );
  }
  const base = base_url.trim().replace(/\/+$/, "");
  try {
    new URL(base);
  } catch {
    return NextResponse.json(
      { ok: false, error: "base_url is not a valid URL." },
      { status: 400 }
    );
  }
  if (!isAllowedUrl(base)) {
    return NextResponse.json(
      { ok: false, error: "base_url must use https, except localhost / private LAN." },
      { status: 400 }
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (typeof api_key === "string" && api_key.trim()) {
      headers.Authorization = `Bearer ${api_key.trim()}`;
    }
    const res = await fetch(`${base}/models`, { headers, signal: ctrl.signal });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Endpoint answered HTTP ${res.status}. Check the URL and key.` },
        { status: 200 }
      );
    }
    const data = (await res.json()) as { data?: unknown };
    const ids = Array.isArray(data?.data)
      ? (data.data as Array<{ id?: unknown }>)
          .map((m) => m?.id)
          .filter((id): id is string => typeof id === "string")
          .slice(0, 100)
      : [];
    return NextResponse.json({ ok: true, models: ids, count: ids.length });
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? `No answer within ${FETCH_TIMEOUT_MS / 1000}s. Check the URL.`
        : "Could not reach the endpoint. Check the URL (and network).";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
