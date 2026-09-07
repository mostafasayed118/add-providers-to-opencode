import { NextResponse } from "next/server";
import { fetchCatalog, matchCatalogModel } from "@/lib/catalog";
import { MODEL_ID_RE, slice100 } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

/** Look a typed model id up in the models.dev catalog for limits/modalities. */
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
  const { model_id } = (body ?? {}) as { model_id?: unknown };
  if (typeof model_id !== "string" || !model_id.trim()) {
    return NextResponse.json(
      { ok: false, error: "Enter a model_id first." },
      { status: 400 }
    );
  }
  const mid = model_id.trim();
  if (mid.length > 128 || !MODEL_ID_RE.test(mid)) {
    return NextResponse.json(
      { ok: false, error: "model_id contains invalid characters." },
      { status: 400 }
    );
  }
  try {
    const catalog = await fetchCatalog();
    const match = matchCatalogModel(catalog, model_id);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: `No catalog entry matches "${slice100(model_id.trim())}". Fill the fields by hand.` },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, match });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach models.dev. Check your network." },
      { status: 200 }
    );
  }
}
