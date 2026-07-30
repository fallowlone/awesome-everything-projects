import { test, expect } from "bun:test";
import {
  TargetTable,
  selectSince,
  advanceWatermark,
  runChecks,
  allPassed,
  runOnce,
  type Row,
} from "../src/etl";

const row = (id: string, updatedAt: number, extra: Record<string, unknown> = {}): Row => ({
  id,
  updatedAt,
  ...extra,
});

const source: Row[] = [
  row("a", 100, { amount: 10 }),
  row("b", 110, { amount: 20 }),
  row("c", 120, { amount: 30 }),
];

test("re-running the same batch does not duplicate rows", () => {
  const t = new TargetTable();
  const first = t.merge(source);
  expect(first).toEqual({ inserted: 3, updated: 0, skipped: 0 });
  expect(t.count).toBe(3);

  const second = t.merge(source);
  expect(second).toEqual({ inserted: 0, updated: 0, skipped: 3 });
  expect(t.count).toBe(3); // the property this whole project exists to prove
});

test("a newer row overwrites, an older row is ignored", () => {
  const t = new TargetTable();
  t.merge([row("a", 100, { amount: 10 })]);

  t.merge([row("a", 200, { amount: 99 })]);
  expect(t.get("a")?.amount).toBe(99);

  // Re-running an OLD batch after a newer one must not resurrect stale values.
  t.merge([row("a", 150, { amount: 55 })]);
  expect(t.get("a")?.amount).toBe(99);
});

test("duplicates inside one batch collapse to the newest, regardless of order", () => {
  const t = new TargetTable();
  const r = t.merge([row("a", 300, { amount: 3 }), row("a", 100, { amount: 1 })]);
  expect(t.count).toBe(1);
  expect(t.get("a")?.amount).toBe(3);
  expect(r.inserted).toBe(1);

  const t2 = new TargetTable();
  t2.merge([row("a", 100, { amount: 1 }), row("a", 300, { amount: 3 })]);
  expect(t2.get("a")?.amount).toBe(3); // order must not decide the outcome
});

test("selectSince is inclusive, so rows sharing the watermark tick are not lost", () => {
  // With second-granularity timestamps several rows share a value; a strict `>`
  // silently drops the ones that landed in the same tick as the last row seen.
  expect(selectSince(source, 110).map((r) => r.id)).toEqual(["b", "c"]);
  expect(selectSince(source, 0)).toHaveLength(3);
  expect(selectSince(source, 999)).toHaveLength(0);
});

test("the watermark only moves forward", () => {
  expect(advanceWatermark(0, source)).toBe(120);
  expect(advanceWatermark(500, source)).toBe(500); // a late small batch cannot rewind it
  expect(advanceWatermark(50, [])).toBe(50);
});

test("quality checks catch a missing natural key and in-batch duplicates", () => {
  const bad = [row("", 100), row("a", 100), row("a", 101)];
  const checks = runChecks(bad);
  expect(allPassed(checks)).toBe(false);
  expect(checks.find((c) => c.name === "natural-key-present")?.passed).toBe(false);
  expect(checks.find((c) => c.name === "no-duplicate-keys-in-batch")?.passed).toBe(false);
});

test("a clean batch passes every check", () => {
  expect(allPassed(runChecks(source, { requiredColumns: ["amount"], maxNullRatio: 0 }))).toBe(true);
});

test("the null-ratio check fails when a required column is too empty", () => {
  const holes = [row("a", 1, { amount: null }), row("b", 2, { amount: 5 })];
  const checks = runChecks(holes, { requiredColumns: ["amount"], maxNullRatio: 0.1 });
  expect(checks.find((c) => c.name === "null-ratio:amount")?.passed).toBe(false);
  // Same data under a looser contract is acceptable — the gate is a policy, not a law.
  expect(allPassed(runChecks(holes, { requiredColumns: ["amount"], maxNullRatio: 0.5 }))).toBe(true);
});

test("an unusable watermark column is caught before it corrupts the watermark", () => {
  const checks = runChecks([{ id: "a", updatedAt: Number.NaN }]);
  expect(checks.find((c) => c.name === "watermark-column-usable")?.passed).toBe(false);
});

test("a failed gate aborts the load and leaves the watermark alone", () => {
  const t = new TargetTable();
  const dirty = [row("a", 100), row("a", 101)]; // duplicate key in batch
  const res = runOnce(dirty, t, 0);
  expect(res.loaded).toBeNull();
  expect(t.count).toBe(0);
  expect(res.watermark).toBe(0); // next run retries the same window
});

test("two identical runs leave the same table and the same watermark", () => {
  const t = new TargetTable();
  const first = runOnce(source, t, 0);
  const second = runOnce(source, t, first.watermark);
  expect(second.watermark).toBe(first.watermark);
  expect(t.count).toBe(3);
  expect(second.loaded).toEqual({ inserted: 0, updated: 0, skipped: 1 }); // only the boundary row is re-read
  expect(t.snapshot().map((r) => r.id)).toEqual(["a", "b", "c"]);
});

test("an incremental run picks up only new work", () => {
  const t = new TargetTable();
  const first = runOnce(source, t, 0);
  const grown = [...source, row("d", 200, { amount: 40 })];
  const second = runOnce(grown, t, first.watermark);
  expect(second.loaded?.inserted).toBe(1);
  expect(t.count).toBe(4);
  expect(second.watermark).toBe(200);
});
