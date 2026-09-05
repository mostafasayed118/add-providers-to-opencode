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

test("cleanup temp home", () => {
  rmSync(tmpHome, { recursive: true, force: true });
  assert.equal(true, true);
});
