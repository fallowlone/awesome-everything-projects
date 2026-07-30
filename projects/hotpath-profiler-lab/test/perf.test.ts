import { test, expect } from "bun:test";
import { percentile, checkBudgets, allWithinBudget, findRegressions, hotPath } from "../src/perf";

test("percentile uses nearest-rank and handles the edges", () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  expect(percentile(v, 50)).toBe(5);
  expect(percentile(v, 90)).toBe(9);
  expect(percentile(v, 100)).toBe(10);
  expect(percentile(v, 0)).toBe(1);
  expect(percentile([42], 99)).toBe(42);
});

test("percentile does not mutate the caller's array", () => {
  // A measurement that reorders the data is a side effect masquerading as a helper.
  const v = [5, 1, 3];
  percentile(v, 50);
  expect(v).toEqual([5, 1, 3]);
});

test("percentile rejects empty input and an out-of-range p", () => {
  expect(() => percentile([], 50)).toThrow();
  expect(() => percentile([1], 101)).toThrow();
  expect(() => percentile([1], -1)).toThrow();
});

test("a percentile is not moved much by one outlier, unlike the mean", () => {
  const clean = Array.from({ length: 99 }, () => 10);
  const withOutlier = [...clean, 900];
  const mean = withOutlier.reduce((a, b) => a + b, 0) / withOutlier.length;
  expect(percentile(withOutlier, 50)).toBe(10);
  expect(mean).toBeGreaterThan(15); // the statistic that hides the experience
});

test("budgets pass when the measurement is inside them", () => {
  const results = checkBudgets(
    [{ metric: "lcp", maxMs: 2500 }, { metric: "bundle", maxBytes: 150_000 }],
    [{ metric: "lcp", valueMs: 1800 }, { metric: "bundle", valueBytes: 120_000 }],
  );
  expect(allWithinBudget(results)).toBe(true);
});

test("a missing measurement fails the budget instead of passing silently", () => {
  // A budget with nothing behind it keeps the dashboard green while the metric is
  // simply absent — worse than having no budget at all.
  const results = checkBudgets([{ metric: "inp", maxMs: 200 }], []);
  expect(allWithinBudget(results)).toBe(false);
  expect(results[0].detail).toMatch(/no measurement/i);
});

test("a mismatched unit fails rather than comparing nonsense", () => {
  const results = checkBudgets([{ metric: "bundle", maxBytes: 100 }], [{ metric: "bundle", valueMs: 5 }]);
  expect(results[0].ok).toBe(false);
});

test("the budget boundary is inclusive", () => {
  expect(allWithinBudget(checkBudgets([{ metric: "lcp", maxMs: 2500 }], [{ metric: "lcp", valueMs: 2500 }]))).toBe(true);
  expect(allWithinBudget(checkBudgets([{ metric: "lcp", maxMs: 2500 }], [{ metric: "lcp", valueMs: 2501 }]))).toBe(false);
});

test("a real regression is reported with its ratio", () => {
  const found = findRegressions(
    [{ metric: "render", valueMs: 100 }],
    [{ metric: "render", valueMs: 150 }],
    { ratio: 1.2, minDeltaMs: 5 },
  );
  expect(found).toHaveLength(1);
  expect(found[0].ratio).toBeCloseTo(1.5, 5);
});

test("noise below the absolute floor is not a regression", () => {
  // 0.2ms → 0.6ms is a 3x ratio and pure jitter on a shared runner. Alerting on it
  // is how a perf gate gets muted within a week.
  const found = findRegressions(
    [{ metric: "tiny", valueMs: 0.2 }],
    [{ metric: "tiny", valueMs: 0.6 }],
    { ratio: 1.2, minDeltaMs: 5 },
  );
  expect(found).toEqual([]);
});

test("a large absolute jump below the ratio threshold is not a regression either", () => {
  const found = findRegressions(
    [{ metric: "big", valueMs: 2000 }],
    [{ metric: "big", valueMs: 2050 }],
    { ratio: 1.2, minDeltaMs: 5 },
  );
  expect(found).toEqual([]); // +50ms on 2s is 2.5%, not a regression
});

test("an improvement is never reported as a regression", () => {
  expect(
    findRegressions([{ metric: "render", valueMs: 200 }], [{ metric: "render", valueMs: 80 }], { ratio: 1.2, minDeltaMs: 5 }),
  ).toEqual([]);
});

test("a metric with no baseline is skipped, not flagged", () => {
  expect(findRegressions([], [{ metric: "new", valueMs: 500 }], { ratio: 1.2, minDeltaMs: 5 })).toEqual([]);
});

test("byte metrics regress on the same rules", () => {
  const found = findRegressions(
    [{ metric: "bundle", valueBytes: 100_000 }],
    [{ metric: "bundle", valueBytes: 170_000 }],
    { ratio: 1.2, minDeltaMs: 5 },
  );
  expect(found.map((r) => r.metric)).toEqual(["bundle"]);
});

test("regressions come back worst-first", () => {
  const found = findRegressions(
    [{ metric: "a", valueMs: 100 }, { metric: "b", valueMs: 100 }],
    [{ metric: "a", valueMs: 130 }, { metric: "b", valueMs: 300 }],
    { ratio: 1.2, minDeltaMs: 5 },
  );
  expect(found.map((r) => r.metric)).toEqual(["b", "a"]);
});

test("the hot path ranks by self time and aggregates repeated frames", () => {
  // Ranking by total time points at `main` on every single run.
  const top = hotPath(
    [
      { name: "main", selfMs: 1 },
      { name: "serialize", selfMs: 40 },
      { name: "serialize", selfMs: 35 },
      { name: "parse", selfMs: 20 },
    ],
    2,
  );
  expect(top).toEqual([
    { name: "serialize", selfMs: 75 },
    { name: "parse", selfMs: 20 },
  ]);
});
