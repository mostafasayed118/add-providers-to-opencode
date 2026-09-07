import { NextResponse } from "next/server";
import { probeModels } from "@/lib/catalog";
import { isAllowedUrl } from "@/lib/provider-schema";
import { MAX_API_KEY_LEN, MAX_URL_LEN } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

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
  const baseTrimmed = base_url.trim();
  if (baseTrimmed.length > MAX_URL_LEN) {
    return NextResponse.json(
      { ok: false, error: "base_url is too long." },
      { status: 400 }
    );
  }
  let base: string;
  try {
    base = baseTrimmed.replace(/\/+$/, "");
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
  if (typeof api_key === "string" && api_key.length > MAX_API_KEY_LEN) {
    return NextResponse.json(
      { ok: false, error: "api_key is too long." },
      { status: 400 }
    );
  }
  const r = await probeModels(
    base_url,
    typeof api_key === "string" ? api_key : undefined
  );
  return NextResponse.json(r, { status: 200 });
}
