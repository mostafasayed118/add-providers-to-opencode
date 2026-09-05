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
    keyStorage: "inline",
    headers: [],
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
    keyStorage: "inline",
    headers: [],
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

test("parseKeyRef detects env and file references", async () => {
  const { parseKeyRef } = await import("../src/lib/opencode-config");
  assert.deepEqual(parseKeyRef("{env:MY_KEY}"), { kind: "env", name: "MY_KEY" });
  assert.deepEqual(parseKeyRef("{file:/tmp/k}"), { kind: "file", name: "/tmp/k" });
  assert.equal(parseKeyRef("sk-plain"), null);
});

test("writeKeyFile stores the exact secret", async () => {
  const { writeKeyFile } = await import("../src/lib/opencode-config");
  const kp = path.join(tmpHome, "keys", "demo.key");
  await writeKeyFile(kp, "sk-file-secret");
  assert.equal(await fs.readFile(kp, "utf8"), "sk-file-secret");
});

test("buildProviderBlock writes headers and interleaved field", () => {
  const { entry } = buildProviderBlock({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "custom",
    providerId: "hdr",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: true,
    reasoning_field: "reasoning_content",
    attachment: false,
    keyStorage: "inline",
    headers: [{ name: "X-Tier", value: "fast" }],
  });
  assert.deepEqual((entry.options as Record<string, unknown>).headers, {
    "X-Tier": "fast",
  });
  const models = entry.models as Record<string, Record<string, unknown>>;
  assert.equal(models.m1.interleaved, "reasoning_content");
});

test("small_model is set when provided and kept otherwise", async () => {
  await saveProviderConfig({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "custom",
    providerId: "small",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
    small_model: "small/cheap-x",
  });
  let raw = await readRaw();
  assert.equal(raw.small_model, "small/cheap-x");
  await saveProviderConfig({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "custom",
    providerId: "small",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
    small_model: undefined,
  });
  raw = await readRaw();
  assert.equal(raw.small_model, "small/cheap-x");
});

test("backups can be listed and restored", async () => {
  const { listBackups, restoreBackup } = await import("../src/lib/opencode-config");
  const before = await listBackups(cfgPath());
  assert.ok(before.length >= 1);
  assert.equal(before[0].kind, "backup");
  const first = await readRaw();
  await saveProviderConfig({
    base_url: "https://changed.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m1",
    providerType: "custom",
    providerId: "small",
    context_limit: undefined,
    output_limit: undefined,
    tool_call: true,
    reasoning: false,
    attachment: false,
  });
  const target = (await listBackups(cfgPath())).find((b) => b.kind === "backup");
  assert.ok(target);
  const res = await restoreBackup(cfgPath(), target.file);
  const restored = await readRaw();
  assert.equal(restored.provider.small.options.baseURL, first.provider.small.options.baseURL);
  assert.equal(typeof res.model, "string");
});

test("restore rejects unrecognized filenames", async () => {
  const { restoreBackup } = await import("../src/lib/opencode-config");
  await assert.rejects(restoreBackup(cfgPath(), "../opencode.json"), /unrecognized/);
  await assert.rejects(restoreBackup(cfgPath(), "opencode.json"), /unrecognized/);
});

test("cloneProvider duplicates the entry under a fresh id", async () => {
  const { cloneProvider } = await import("../src/lib/opencode-config");
  const { newId } = await cloneProvider(cfgPath(), "SMALL");
  assert.match(newId, /^small-copy/);
  const raw = await readRaw();
  assert.deepEqual(raw.provider[newId].options, raw.provider.small.options);
  assert.notEqual(newId, "small");
});

test("history records actions newest-first without secrets", async () => {
  const { logHistory, readHistory } = await import("../src/lib/opencode-config");
  await logHistory(cfgPath(), "save", { provider: "p1", model: "p1/m1" });
  await logHistory(cfgPath(), "delete", { provider: "p2", model: null });
  const entries = await readHistory(cfgPath(), 10);
  assert.equal(entries[0].action, "delete");
  assert.equal(entries[1].action, "save");
  assert.equal(JSON.stringify(entries).includes("sk-"), false);
});

test("checkConfig flags empty, keyless, dangling and limitless entries", async () => {
  const { checkConfig } = await import("../src/lib/opencode-config");
  const issues = checkConfig({
    provider: {
      empty: { options: { baseURL: "https://x.example.com", apiKey: "k" }, models: {} },
      nokey: {
        options: { baseURL: "https://x.example.com" },
        models: { m: { name: "m" } },
      },
      badurl: {
        options: { baseURL: "not a url", apiKey: "k" },
        models: { m: { name: "m", limit: { context: 1 } } },
      },
      nolimit: {
        options: { baseURL: "https://x.example.com", apiKey: "k" },
        models: { m: { name: "m" } },
      },
    },
    model: "ghost/nothing",
  });
  const ids = issues.map((i) => i.id);
  assert.ok(ids.includes("empty:empty"));
  assert.ok(ids.includes("nokey:nokey"));
  assert.ok(ids.includes("badurl:badurl"));
  assert.ok(ids.some((id) => id.startsWith("nolimit:")));
  assert.ok(ids.includes("dangling-model"));
  assert.equal(
    issues.find((i) => i.id === "dangling-model")?.fixable,
    true
  );
});

test("mergeProviderEntry is pure and reusable for preview", async () => {
  const { mergeProviderEntry } = await import("../src/lib/opencode-config");
  const merged = mergeProviderEntry(
    { provider: {}, model: null },
    {
      base_url: "https://api.example.com/v1",
      api_key: "sk-test-12345678",
      model_id: "m1",
      providerType: "custom",
      providerId: "pv",
      context_limit: undefined,
      output_limit: undefined,
      tool_call: true,
      reasoning: false,
      attachment: false,
      keyStorage: "inline",
      headers: [],
    }
  );
  assert.equal(merged.model, "pv/m1");
  assert.ok("pv" in merged.providers);
});

test("redactSecrets hides keys and header values, keeps structure", async () => {
  const { redactSecrets } = await import("../src/lib/opencode-config");
  const out = redactSecrets({
    options: { baseURL: "https://x.example.com", apiKey: "sk-live", headers: { A: "s3", B: "" } },
    models: { m: { name: "m" } },
  }) as Record<string, Record<string, unknown>>;
  assert.equal(out.options.apiKey, "•••");
  assert.deepEqual(out.options.headers, { A: "•••", B: "" });
  assert.equal(out.options.baseURL, "https://x.example.com");
  assert.equal((out.models.m as Record<string, unknown>).name, "m");
});

test("gateOf/withGate follow the disabled-wins rule", async () => {
  const { gateOf, withGate } = await import("../src/lib/opencode-config");
  const base = { enabled_providers: ["a"], disabled_providers: ["b"] };
  assert.equal(gateOf(base, "a"), "enabled");
  assert.equal(gateOf(base, "b"), "disabled");
  assert.equal(gateOf(base, "c"), "auto");
  const moved = withGate(base, "a", "disabled");
  assert.deepEqual(moved.disabled_providers, ["b", "a"]);
  assert.deepEqual(moved.enabled_providers, []);
  const cleared = withGate(moved, "a", "auto");
  assert.equal("enabled_providers" in cleared, false);
  assert.deepEqual(cleared.disabled_providers, ["b"]);
});

test("setProviderGate rejects unknown providers", async () => {
  const { setProviderGate } = await import("../src/lib/opencode-config");
  await assert.rejects(setProviderGate(cfgPath(), "ghost", "disabled"), /does not exist/);
});

test("deleteManyProviders removes a batch with one backup", async () => {
  const { deleteManyProviders } = await import("../src/lib/opencode-config");
  const mk = (pid: string) =>
    saveProviderConfig({
      base_url: "https://api.example.com/v1",
      api_key: "sk-test-12345678",
      model_id: "m",
      providerType: "custom",
      providerId: pid,
      context_limit: undefined,
      output_limit: undefined,
      tool_call: true,
      reasoning: false,
      attachment: false,
      keyStorage: "inline",
      headers: [],
    });
  await mk("bulk1");
  await mk("bulk2");
  const res = await deleteManyProviders(cfgPath(), ["BULK1", "bulk2"]);
  assert.equal(res.backup === null || typeof res.backup === "string", true);
  const raw = await readRaw();
  assert.equal("bulk1" in raw.provider, false);
  assert.equal("bulk2" in raw.provider, false);
  await assert.rejects(deleteManyProviders(cfgPath(), []), /No providers/);
  await assert.rejects(deleteManyProviders(cfgPath(), ["ghost"]), /Unknown providers/);
});

test("validatePack accepts good packs and rejects keyless ones", async () => {
  const { validatePack } = await import("../src/lib/opencode-config");
  const good = validatePack({
    providers: {
      p1: {
        options: { baseURL: "https://x.example.com", apiKey: "k" },
        models: { m: { name: "m" } },
      },
    },
  });
  assert.equal(good.ok, true);
  const bad = validatePack({
    providers: {
      p1: { options: { baseURL: "https://x.example.com" }, models: { m: { name: "m" } } },
    },
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /no key/i);
  assert.equal(validatePack({ providers: {} }).ok, false);
  assert.equal(validatePack(null).ok, false);
});

test("importPack merges entries and keeps existing ones", async () => {
  const { importPack, validatePack } = await import("../src/lib/opencode-config");
  const checked = validatePack({
    providers: {
      imp1: {
        options: { baseURL: "https://imp.example.com", apiKey: "{env:IMP_KEY}" },
        models: { m: { name: "m" } },
      },
    },
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("pack should validate");
  const res = await importPack(cfgPath(), checked.pack);
  assert.deepEqual(res.imported, ["imp1"]);
  const raw = await readRaw();
  assert.equal(raw.provider.imp1.options.apiKey, "{env:IMP_KEY}");
});

test("resolveConfigPath handles global/project/custom targets", async () => {
  const { resolveConfigPath, getGlobalConfigPath } = await import("../src/lib/opencode-config");
  assert.equal(await resolveConfigPath(undefined), getGlobalConfigPath());
  assert.equal(await resolveConfigPath({ kind: "global" }), getGlobalConfigPath());
  assert.equal(
    await resolveConfigPath({ kind: "project", dir: tmpHome }),
    path.join(tmpHome, "opencode.json")
  );
  await assert.rejects(resolveConfigPath({ kind: "project", dir: "" }), /folder/);
  await assert.rejects(
    resolveConfigPath({ kind: "project", dir: path.join(tmpHome, "missing") }),
    /not found/
  );
  assert.equal(
    await resolveConfigPath({ kind: "custom", path: path.join(tmpHome, "c.json") }),
    path.join(tmpHome, "c.json")
  );
  await assert.rejects(resolveConfigPath({ kind: "custom", path: "c.txt" }), /json/);
  await assert.rejects(resolveConfigPath({ kind: "weird" }), /Unknown/);
});

test("cleanup temp home", () => {
  rmSync(tmpHome, { recursive: true, force: true });
  assert.equal(true, true);
});
