import { test, expect } from "bun:test";
import { visibleRange } from "../src/grid";

// 1. Top of list — start clamps to 0 (NOT -overscan)
test("top: start clamps to 0 and end includes overscan", () => {
  const r = visibleRange({ scrollTop: 0, rowHeight: 20, viewportH: 100, total: 1000, overscan: 2 });
  // first = floor(0/20) = 0; start = max(0, 0-2) = 0
  // visible = ceil(100/20) = 5; end = min(1000, 0+5+2) = 7
  expect(r.start).toBe(0);
  expect(r.end).toBe(7);
  expect(r.padTop).toBe(0);
});

// 2. Middle — unclamped start and end
test("middle: start and end computed without clamping", () => {
  const r = visibleRange({ scrollTop: 2000, rowHeight: 20, viewportH: 100, total: 1000, overscan: 2 });
  // first = floor(2000/20) = 100; start = max(0, 100-2) = 98
  // visible = ceil(100/20) = 5; end = min(1000, 100+5+2) = 107
  expect(r.start).toBe(98);
  expect(r.end).toBe(107);
});

// 3. Bottom — end clamps to total and padBottom is 0
test("bottom: end clamps to total and padBottom is 0", () => {
  const r = visibleRange({ scrollTop: 20000, rowHeight: 20, viewportH: 100, total: 1000, overscan: 2 });
  // first = floor(20000/20) = 1000; start = max(0, 1000-2) = 998
  // visible = ceil(100/20) = 5; end = min(1000, 1000+5+2) = 1000
  expect(r.end).toBe(1000);
  expect(r.padBottom).toBe(0);
});

// 4. Spacer invariant for the middle case
test("invariant: padTop + rendered height + padBottom === total * rowHeight", () => {
  const r = visibleRange({ scrollTop: 2000, rowHeight: 20, viewportH: 100, total: 1000, overscan: 2 });
  const total = 1000;
  const rowHeight = 20;
  expect(r.padTop + (r.end - r.start) * rowHeight + r.padBottom).toBe(total * rowHeight);
});

// 5. Guard: rowHeight 0 returns all-zero range, no throw
test("guard: rowHeight === 0 returns zero range without throwing", () => {
  const r = visibleRange({ scrollTop: 0, rowHeight: 0, viewportH: 100, total: 10, overscan: 1 });
  expect(r).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
});
