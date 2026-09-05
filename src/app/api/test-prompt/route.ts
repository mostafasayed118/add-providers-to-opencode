import { NextResponse } from "next/server";
import { isAllowedUrl } from "@/lib/provider-schema";

export const dynamic = "force-dynamic";

const PROMPT_TIMEOUT_MS = 30_000;

/**
 * Sends a real one-word chat completion to prove the endpoint + key + model
 * actually answer. Costs a few tokens by design.
 */
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
  const { base_url, api_key, model_id } = (body ?? {}) as {
    base_url?: unknown;
    api_key?: unknown;
    model_id?: unknown;
  };
  if (typeof base_url !== "string" || !base_url.trim()) {
    return NextResponse.json({ ok: false, error: "Enter a base_url first." }, { status: 400 });
  }
  if (typeof api_key !== "string" || !api_key.trim()) {
    return NextResponse.json({ ok: false, error: "Enter an API key first." }, { status: 400 });
  }
  if (typeof model_id !== "string" || !model_id.trim()) {
    return NextResponse.json({ ok: false, error: "Enter a model_id first." }, { status: 400 });
  }
  const base = base_url.trim().replace(/\/+$/, "");
  try {
    new URL(base);
  } catch {
    return NextResponse.json({ ok: false, error: "base_url is not a valid URL." }, { status: 400 });
  }
  if (!isAllowedUrl(base)) {
    return NextResponse.json(
      { ok: false, error: "base_url must use https, except localhost / private LAN." },
      { status: 400 }
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROMPT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key.trim()}`,
      },
      body: JSON.stringify({
        model: model_id.trim(),
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with exactly this word: ok" }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `HTTP ${res.status}. ${text.slice(0, 200) || "Check the URL, key, and model id."}`,
        },
        { status: 200 }
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const reply =
      data.choices?.[0]?.message?.content != null
        ? String(data.choices[0].message.content).slice(0, 500)
        : "(empty reply)";
    return NextResponse.json({ ok: true, reply });
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? `No answer within ${PROMPT_TIMEOUT_MS / 1000}s. The model may be slow or the URL wrong.`
        : "Could not reach the endpoint. Check the URL (and network).";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
