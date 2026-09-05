import { NextResponse } from "next/server";
import { probeModels } from "@/lib/catalog";

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
  const r = await probeModels(
    base_url,
    typeof api_key === "string" ? api_key : undefined
  );
  return NextResponse.json(r, { status: 200 });
}
