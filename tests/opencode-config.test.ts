import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import {
  saveProviderConfig,
  listProviders,
  getStoredApiKey,
  getGlobalConfigPath,
  buildProviderBlock,
} from "../src/lib/opencode-config";

// Isolate ALL filesystem effects: point "home" at a temp dir. The config
// module calls os.homedir() per operation, so setting env vars up front
// (before any test runs) is sufficient.
const tmpHome = mkdtempSync(path.join(os.tmpdir(), "opencode-cfg-test-"));
process.env.USERPROFILE = tmpHome;
process.env.HOME = tmpHome;

const cfgPath = () => path.join(tmpHome, ".config", "opencode", "opencode.json");
const readRaw = async () => JSON.parse(await fs.readFile(cfgPath(), "utf8"));

test("getGlobalConfigPath resolves under the isolated home", () => {
  assert.equal(getGlobalConfigPath(), cfgPath());
});

test("buildProviderBlock writes modalities, limits and model ref", () => {
  const { providerId, entry, model } = buildProviderBlock({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "custom",
    providerId: "demo",
    context_limit: 1000,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: true,
  });
  assert.equal(providerId, "demo");
  assert.equal(model, "demo/m1");
  const models = entry.models as Record<string, Record<string, unknown>>;
  assert.deepEqual(models.m1.modalities, { input: ["text", "image"], output: ["text"] });
  assert.deepEqual(models.m1.limit, { context: 1000 });
});

test("buildProviderBlock omits image modality when attachment is false", () => {
  const { entry } = buildProviderBlock({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "openai-compatible",
    providerId: "custom",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  });
  const models = entry.models as Record<string, Record<string, unknown>>;
  assert.deepEqual(models.m1.modalities, { input: ["text"], output: ["text"] });
  assert.equal(models.m1.limit, undefined);
});

test("saveProviderConfig creates the file with no backup on first write", async () => {
  const res = await saveProviderConfig({
    base_url: "https://api.example.com/v1/",
    api_key: "sk-original-key-123",
    model_id: "m1",
    providerType: "custom",
    providerId: "editme",
    context_limit: 1000,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  });
  assert.equal(res.path, cfgPath());
  assert.equal(res.model, "editme/m1");
  assert.equal(res.backup, null);
  const raw = await readRaw();
  assert.equal(raw.model, "editme/m1");
  assert.equal(raw.provider.editme.options.baseURL, "https://api.example.com/v1");
});

test("second save creates a backup and preserves unrelated keys", async () => {
  await saveProviderConfig({
    base_url: "https://api.example.com/v2",
    api_key: "sk-original-key-123",
    model_id: "m1",
    providerType: "custom",
    providerId: "editme",
    context_limit: 2000,
    output_limit: undefined,
    tool_call: true,
    reasoning: true,
    attachment: false,
  });
  const raw = await readRaw();
  assert.equal(raw.provider.editme.options.baseURL, "https://api.example.com/v2");
  assert.equal(raw.provider.editme.options.apiKey, "sk-original-key-123");
  const dir = path.dirname(cfgPath());
  const backups = (await fs.readdir(dir)).filter((f) => f.startsWith("opencode.json.bak."));
  assert.equal(backups.length >= 1, true);
});

test("listProviders redacts secrets and reports capabilities", async () => {
  const list = await listProviders(cfgPath());
  const p = list.find((x) => x.id === "editme");
  assert.ok(p);
  assert.equal(p.hasKey, true);
  assert.equal(JSON.stringify(list).includes("sk-original-key-123"), false);
  assert.equal(p.models[0].limit?.context, 2000);
  assert.equal(p.models[0].reasoning, true);
});

test("getStoredApiKey returns the key, null for unknown providers", async () => {
  assert.equal(await getStoredApiKey(cfgPath(), "editme"), "sk-original-key-123");
  assert.equal(await getStoredApiKey(cfgPath(), "nope"), null);
});

test("saveProviderConfig throws without a key (route must fill it first)", async () => {
  await assert.rejects(
    saveProviderConfig({
      base_url: "https://api.example.com/v1",
      api_key: undefined,
      model_id: "m1",
      providerType: "custom",
      providerId: "newbie",
      context_limit: undefined,
      output_limit: undefined,
      tool_call: true,
      reasoning: false,
      attachment: false,
    }),
    /api_key is required/
  );
});

test("sibling models survive an edit of one model", async () => {
  const base = {
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    providerType: "custom",
    providerId: "multi",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  } as const;
  await saveProviderConfig({ ...base, model_id: "a" });
  await saveProviderConfig({ ...base, model_id: "b", context_limit: 999 });
  const raw = await readRaw();
  assert.deepEqual(Object.keys(raw.provider.multi.models).sort(), ["a", "b"]);
  assert.equal(raw.provider.multi.models.b.limit.context, 999);
});

test("renaming a model removes the old entry", async () => {
  await saveProviderConfig({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "b-renamed",
    editModelId: "b",
    providerType: "custom",
    providerId: "multi",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  });
  const raw = await readRaw();
  assert.deepEqual(Object.keys(raw.provider.multi.models).sort(), ["a", "b-renamed"]);
});

test("friendly display names are preserved on edit", async () => {
  const raw = await readRaw();
  raw.provider.multi.models.a.name = "Model A Friendly";
  await fs.writeFile(cfgPath(), JSON.stringify(raw), "utf8");
  await saveProviderConfig({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "a",
    providerType: "custom",
    providerId: "multi",
    context_limit: 5,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  });
  const after = await readRaw();
  assert.equal(after.provider.multi.models.a.name, "Model A Friendly");
  assert.equal(after.provider.multi.models.a.limit.context, 5);
});

test("concurrent saves all succeed and leave a valid file", async () => {
  const mk = (i: number) =>
    saveProviderConfig({
      base_url: "https://api.example.com/v1",
      api_key: "sk-test-12345678",
      model_id: `c${i}`,
      providerType: "custom",
      providerId: "races",
      context_limit: undefined,
      output_limit: undefined,
      tool_call: true,
      reasoning: false,
      attachment: false,
    });
  const results = await Promise.all([mk(0), mk(1), mk(2), mk(3), mk(4)]);
  assert.equal(results.length, 5);
  const raw = await readRaw(); // throws if the file is torn/invalid JSON
  assert.deepEqual(Object.keys(raw.provider.races.models).sort(), [
    "c0",
    "c1",
    "c2",
    "c3",
    "c4",
  ]);
});

test("stale locks are reclaimed", async () => {
  const { withConfigLock } = await import("../src/lib/opencode-config");
  const lockDir = `${cfgPath()}.lock`;
  await fs.mkdir(lockDir, { recursive: true });
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(lockDir, old, old);
  const out = await withConfigLock(cfgPath(), async () => "recovered");
  assert.equal(out, "recovered");
});

test("deleteProvider removes the entry and repoints the active model", async () => {
  const { deleteProvider } = await import("../src/lib/opencode-config");
  const res = await deleteProvider(cfgPath(), "races");
  assert.equal(res.backup === null || typeof res.backup === "string", true);
  const raw = await readRaw();
  assert.equal("races" in raw.provider, false);
  // editme/m1 was untouched; active model handling exercised below instead.
  void res;
  const res2 = await deleteProvider(cfgPath(), "multi");
  assert.equal(res2.clearedActiveModel, false); // active model is editme/m1
  const raw2 = await readRaw();
  assert.equal("multi" in raw2.provider, false);
});

test("deleting the active provider falls back to a remaining model", async () => {
  const { deleteProvider } = await import("../src/lib/opencode-config");
  const base = {
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    providerType: "custom",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  } as const;
  await saveProviderConfig({ ...base, model_id: "x", providerId: "keepA" });
  await saveProviderConfig({ ...base, model_id: "y", providerId: "keepB" });
  // Force the active model to keepA/x regardless of save order.
  const raw = await readRaw();
  raw.model = "keepA/x";
  await fs.writeFile(cfgPath(), JSON.stringify(raw), "utf8");
  const res = await deleteProvider(cfgPath(), "keepA");
  assert.equal(res.clearedActiveModel, true);
  // Falls back to the first remaining provider's first model (insertion order).
  const after = await readRaw();
  const remaining = Object.entries(
    after.provider as Record<string, { models: Record<string, unknown> }>
  );
  assert.ok(remaining.length > 0);
  assert.equal(res.newModel, `${remaining[0][0]}/${Object.keys(remaining[0][1].models)[0]}`);
  assert.equal(after.model, res.newModel);
  await deleteProvider(cfgPath(), "keepB");
});

test("deleting an unknown provider throws", async () => {
  const { deleteProvider } = await import("../src/lib/opencode-config");
  await assert.rejects(deleteProvider(cfgPath(), "ghost"), /does not exist/);
});

test("corrupt config throws and preserves a .corrupt copy", async () => {
  const { readExistingConfig } = await import("../src/lib/opencode-config");
  await fs.writeFile(cfgPath(), "{ not json", "utf8");
  await assert.rejects(readExistingConfig(cfgPath()), /not valid JSON/);
  const dir = path.dirname(cfgPath());
  const corrupt = (await fs.readdir(dir)).filter((f) => f.startsWith("opencode.json.corrupt-"));
  assert.equal(corrupt.length >= 1, true);
  // Restore a valid file so later tests (none) are unaffected.
  await fs.writeFile(cfgPath(), JSON.stringify({ provider: {}, model: null }), "utf8");
});

test("cleanup temp home", () => {
  rmSync(tmpHome, { recursive: true, force: true });
  assert.equal(true, true);
});
