import test from "node:test";
import assert from "node:assert/strict";
import {
  matchCatalogModel,
  normalizeCatalog,
  probeModels,
} from "../src/lib/catalog";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";

test("normalizeCatalog handles models.dev shapes and OpenAI lists", () => {
  const out = normalizeCatalog({
    models: [
      { id: "a/m1", limit: { context: 100, output: 10 }, modalities: { input: ["text", "image"] } },
      { id: "m1" },
    ],
    other: { data: [{ id: "b/m2", limit: { context: 50 } }] },
  });
  const byId = Object.fromEntries(out.map((m) => [m.id, m]));
  assert.equal(byId["a/m1"].context, 100);
  assert.equal(byId["a/m1"].imageInput, true);
  assert.equal(byId["m1"].context, undefined);
  assert.equal(byId["b/m2"].context, 50);
});

test("normalizeCatalog dedupes by id", () => {
  const out = normalizeCatalog([{ id: "x" }, { id: "x" }]);
  assert.equal(out.length, 1);
});

test("matchCatalogModel prefers exact, then suffix, then null", () => {
  const catalog = [
    { id: "vendor/cool-model" },
    { id: "other/cool-model", context: 5 },
    { id: "plain" },
  ];
  assert.equal(matchCatalogModel(catalog, "vendor/cool-model")?.id, "vendor/cool-model");
  assert.equal(matchCatalogModel(catalog, "cool-model")?.context, 5);
  assert.equal(matchCatalogModel(catalog, "plain")?.id, "plain");
  assert.equal(matchCatalogModel(catalog, "nope"), null);
  assert.equal(matchCatalogModel(catalog, "  "), null);
});

test("probeModels reads /models and rejects bad urls", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "m1" }, { id: 42 }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    const ok = await probeModels(`http://127.0.0.1:${port}/v1`, "k");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.models, ["m1"]);
    const bad = await probeModels("not-a-url");
    assert.equal(bad.ok, false);
    const pub = await probeModels("http://example.com/v1");
    assert.equal(pub.ok, false);
  } finally {
    server.close();
  }
});
