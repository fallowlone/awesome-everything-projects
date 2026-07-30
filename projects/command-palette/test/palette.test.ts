import { test, expect } from "bun:test";
import { fuzzyRank, reduce } from "../src/palette";
import type { PaletteState } from "../src/palette";

// 1. fuzzyRank filters and orders by match quality
test("fuzzyRank: prefix/contiguous match ranks above scattered; non-match excluded", () => {
  const result = fuzzyRank(["foobar", "xfoo", "baz"], "foo");
  expect(result).not.toContain("baz");
  const foobarIdx = result.indexOf("foobar");
  const xfooIdx = result.indexOf("xfoo");
  expect(foobarIdx).toBeGreaterThanOrEqual(0);
  expect(xfooIdx).toBeGreaterThanOrEqual(0);
  expect(foobarIdx).toBeLessThan(xfooIdx);
});

// 2. empty query preserves original order
test("fuzzyRank: empty query returns items in original order", () => {
  expect(fuzzyRank(["b", "a", "c"], "")).toEqual(["b", "a", "c"]);
});

// 3. non-subsequence excluded
test("fuzzyRank: non-subsequence query returns empty array", () => {
  expect(fuzzyRank(["abc"], "xyz")).toEqual([]);
});

// 4. case-insensitive matching
test("fuzzyRank: matching is case-insensitive", () => {
  const result = fuzzyRank(["Foo"], "foo");
  expect(result).toContain("Foo");
});

// 5. reduce down wraps at end
test("reduce down: wraps from last index to 0", () => {
  const state: PaletteState = { items: ["a", "b", "c"], selected: 2 };
  expect(reduce(state, { type: "down" }).selected).toBe(0);
});

// 6. reduce up wraps at start
test("reduce up: wraps from 0 to last index", () => {
  const state: PaletteState = { items: ["a", "b", "c"], selected: 0 };
  expect(reduce(state, { type: "up" }).selected).toBe(2);
});

// 7. reduce on empty items does not throw
test("reduce down: empty items list returns selected 0 without throwing", () => {
  const state: PaletteState = { items: [], selected: 0 };
  const next = reduce(state, { type: "down" });
  expect(next.selected).toBe(0);
  expect(Number.isNaN(next.selected)).toBe(false);
});

// 8. enter is a no-op
test("reduce enter: returns state unchanged (deep equal)", () => {
  const state: PaletteState = { items: ["a"], selected: 0 };
  const next = reduce(state, { type: "enter" });
  expect(next).toEqual(state);
});
