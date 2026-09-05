import test from "node:test";
import assert from "node:assert/strict";
import { diffJson, diffLines } from "../src/lib/diff";

test("diffLines marks added and removed lines", () => {
  const out = diffLines("a\nb\nc", "a\nx\nc");
  assert.deepEqual(out, [
    { type: "same", text: "a" },
    { type: "del", text: "b" },
    { type: "add", text: "x" },
    { type: "same", text: "c" },
  ]);
});

test("diffLines handles empty old text as all-added", () => {
  const out = diffLines("", "a");
  // "".split("\n") is [""], so one del + one add.
  assert.ok(out.some((l) => l.type === "add" && l.text === "a"));
});

test("diffJson spots a changed value", () => {
  const out = diffJson({ a: 1, b: 2 }, { a: 1, b: 3 });
  assert.ok(out.some((l) => l.type === "del" && l.text.includes("2")));
  assert.ok(out.some((l) => l.type === "add" && l.text.includes("3")));
});

test("diffJson of identical values is all same", () => {
  const out = diffJson({ a: [1, 2] }, { a: [1, 2] });
  assert.ok(out.length > 0 && out.every((l) => l.type === "same"));
});
