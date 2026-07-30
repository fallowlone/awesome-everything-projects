import { test, expect } from "bun:test";
import { lcs, diff } from "../src/diff";

// ── helpers ────────────────────────────────────────────────────────────────

/** Reconstruct b from the edit script (keep + insert). */
function applyInserts<T>(script: ReturnType<typeof diff<T>>): T[] {
  return script
    .filter((op) => op.op === "keep" || op.op === "insert")
    .map((op) => op.value);
}

/** Reconstruct a from the edit script (keep + delete). */
function applyDeletes<T>(script: ReturnType<typeof diff<T>>): T[] {
  return script
    .filter((op) => op.op === "keep" || op.op === "delete")
    .map((op) => op.value);
}

// ── lcs ───────────────────────────────────────────────────────────────────

test("lcs: identical arrays → entire array is the LCS", () => {
  expect(lcs(["a", "b", "c"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
});

test("lcs: first array empty → LCS is empty", () => {
  expect(lcs([], ["a", "b"])).toEqual([]);
});

test("lcs: second array empty → LCS is empty", () => {
  expect(lcs(["a", "b"], [])).toEqual([]);
});

test("lcs: interleaved change → correct LCS", () => {
  // a = [a,b,c,d]  b = [a,x,c,d]  → LCS = [a,c,d]
  expect(lcs(["a", "b", "c", "d"], ["a", "x", "c", "d"])).toEqual([
    "a",
    "c",
    "d",
  ]);
});

test("lcs: works for numbers", () => {
  expect(lcs([1, 2, 3], [1, 3])).toEqual([1, 3]);
});

// ── diff: structural ───────────────────────────────────────────────────────

test("diff: identical arrays → every op is 'keep'", () => {
  const script = diff(["a", "b", "c"], ["a", "b", "c"]);
  expect(script.every((op) => op.op === "keep")).toBe(true);
  expect(script.map((op) => op.value)).toEqual(["a", "b", "c"]);
});

test("diff: empty a → all ops are 'insert'", () => {
  const script = diff([], ["x", "y"]);
  expect(script.every((op) => op.op === "insert")).toBe(true);
  expect(script.map((op) => op.value)).toEqual(["x", "y"]);
});

test("diff: empty b → all ops are 'delete'", () => {
  const script = diff(["x", "y"], []);
  expect(script.every((op) => op.op === "delete")).toBe(true);
  expect(script.map((op) => op.value)).toEqual(["x", "y"]);
});

test("diff: interleaved change produces correct keep/delete/insert script", () => {
  // a=[a,b,c] b=[a,x,c]  expected minimal script:
  //   keep a, delete b, insert x, keep c
  const script = diff(["a", "b", "c"], ["a", "x", "c"]);
  // Must contain at least one delete and one insert
  expect(script.some((op) => op.op === "delete")).toBe(true);
  expect(script.some((op) => op.op === "insert")).toBe(true);
  // Round-trip: keep+insert → b
  expect(applyInserts(script)).toEqual(["a", "x", "c"]);
  // Round-trip: keep+delete → a
  expect(applyDeletes(script)).toEqual(["a", "b", "c"]);
});

// ── diff: round-trip invariants ────────────────────────────────────────────

test("round-trip: keep+insert reproduces b (general)", () => {
  const a = ["a", "b", "c", "d", "e"];
  const b = ["b", "c", "e", "f"];
  const script = diff(a, b);
  expect(applyInserts(script)).toEqual(b);
});

test("round-trip: keep+delete reproduces a (general)", () => {
  const a = ["a", "b", "c", "d", "e"];
  const b = ["b", "c", "e", "f"];
  const script = diff(a, b);
  expect(applyDeletes(script)).toEqual(a);
});

test("round-trip: both empty arrays", () => {
  const script = diff<string>([], []);
  expect(applyInserts(script)).toEqual([]);
  expect(applyDeletes(script)).toEqual([]);
});

// ── minimality ─────────────────────────────────────────────────────────────

test("minimality: non-keep op count equals len(a)+len(b)-2*len(lcs)", () => {
  const pairs: [string[], string[]][] = [
    [["a", "b", "c"], ["a", "x", "c"]],
    [["a", "b", "c", "d", "e"], ["b", "c", "e", "f"]],
    [[], ["x", "y", "z"]],
    [["p", "q"], []],
    [["a", "b", "c", "d"], ["a", "x", "c", "d"]],
  ];
  for (const [a, b] of pairs) {
    const script = diff(a, b);
    const nonKeep = script.filter((op) => op.op !== "keep").length;
    const expected = a.length + b.length - 2 * lcs(a, b).length;
    expect(nonKeep).toBe(expected);
  }
});
