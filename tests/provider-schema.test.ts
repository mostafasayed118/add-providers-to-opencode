import test from "node:test";
import assert from "node:assert/strict";
import {
  providerSchema,
  toFieldErrors,
  isAllowedUrl,
} from "../src/lib/provider-schema";

const valid = {
  base_url: "https://api.example.com/v1/",
  api_key: "sk-test-12345678",
  model_id: "my-model_x1",
  providerType: "custom",
  providerId: "MyProv",
  context_limit: 262144,
  output_limit: 65536,
  tool_call: true,
  reasoning: true,
  attachment: true,
} as const;

test("accepts a full valid payload and normalizes it", () => {
  const r = providerSchema.safeParse({ ...valid });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.base_url, "https://api.example.com/v1");
    assert.equal(r.data.providerId, "myprov");
  }
});

test("applies defaults and drops blank limits", () => {
  const r = providerSchema.safeParse({
    base_url: "https://api.example.com/v1",
    api_key: "sk-test-12345678",
    model_id: "m",
    providerType: "openai-compatible",
    providerId: "custom",
    context_limit: "",
    output_limit: "",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.context_limit, undefined);
    assert.equal(r.data.tool_call, true);
    assert.equal(r.data.reasoning, false);
    assert.equal(r.data.attachment, false);
  }
});

test("rejects non-URL base_url", () => {
  const errors = toFieldErrors(
    providerSchema.safeParse({ ...valid, base_url: "not-a-url" })
  );
  assert.match(errors.base_url ?? "", /valid URL/);
});

test("rejects http for public hosts but allows localhost", () => {
  assert.equal(isAllowedUrl("http://example.com/v1"), false);
  assert.equal(isAllowedUrl("http://localhost:8080/v1"), true);
  assert.equal(isAllowedUrl("http://127.0.0.1:8000/v1"), true);
  assert.equal(isAllowedUrl("https://api.example.com/v1"), true);
  const errors = toFieldErrors(
    providerSchema.safeParse({ ...valid, base_url: "http://example.com/v1" })
  );
  assert.match(errors.base_url ?? "", /https/);
});

test("rejects short api_key but allows it to be omitted (edit flow)", () => {
  const short = toFieldErrors(
    providerSchema.safeParse({ ...valid, api_key: "short" })
  );
  assert.match(short.api_key ?? "", /at least 8/);
  const omitted = providerSchema.safeParse({ ...valid, api_key: undefined });
  assert.equal(omitted.success, true);
});

test("rejects model ids with spaces or symbols", () => {
  const errors = toFieldErrors(
    providerSchema.safeParse({ ...valid, model_id: "bad id!" })
  );
  assert.match(errors.model_id ?? "", /no spaces/);
});

test("rejects bad custom provider ids", () => {
  const errors = toFieldErrors(
    providerSchema.safeParse({ ...valid, providerId: "Bad_ID!" })
  );
  assert.match(errors.providerId ?? "", /lowercase/);
});

test("rejects non-positive limits", () => {
  const errors = toFieldErrors(
    providerSchema.safeParse({ ...valid, context_limit: -5 })
  );
  assert.match(errors.context_limit ?? "", /positive/);
  const frac = toFieldErrors(
    providerSchema.safeParse({ ...valid, output_limit: 1.5 })
  );
  assert.match(frac.output_limit ?? "", /whole number/);
});

test("toFieldErrors returns {} on success", () => {
  const r = providerSchema.safeParse({ ...valid });
  assert.deepEqual(toFieldErrors(r), {});
});
