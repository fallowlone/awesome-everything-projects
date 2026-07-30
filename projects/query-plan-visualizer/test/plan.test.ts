import { test, expect } from "bun:test";
import {
  parseExplain,
  flatten,
  estimateError,
  worstEstimate,
  worstSelfTime,
  type RawNode,
} from "../src/plan";

// A nested loop whose inner index scan runs 5,000 times. Every per-loop number
// below has to be multiplied by Loops before a human sees it.
const nestedLoop: RawNode = {
  "Node Type": "Nested Loop",
  "Plan Rows": 5000,
  "Actual Rows": 5000,
  "Actual Total Time": 820,
  Loops: 1,
  Plans: [
    {
      "Node Type": "Seq Scan",
      "Relation Name": "orders",
      "Plan Rows": 5000,
      "Actual Rows": 5000,
      "Actual Total Time": 20,
      Loops: 1,
    },
    {
      "Node Type": "Index Scan",
      "Relation Name": "customers",
      "Plan Rows": 1,
      "Actual Rows": 1,
      "Actual Total Time": 0.15,
      Loops: 5000,
    },
  ],
};

const explainPayload = [{ Plan: nestedLoop }];

test("parses the array payload EXPLAIN actually returns", () => {
  const root = parseExplain(explainPayload);
  expect(root.nodeType).toBe("Nested Loop");
  expect(root.children).toHaveLength(2);
  expect(flatten(root)).toHaveLength(3);
});

test("rejects a payload that is not EXPLAIN JSON", () => {
  expect(() => parseExplain({ nope: true })).toThrow();
});

test("actual rows are totals across loops, not per-loop", () => {
  const root = parseExplain(explainPayload);
  const indexScan = root.children[1];
  expect(indexScan.loops).toBe(5000);
  expect(indexScan.actualRows).toBe(5000); // 1 row × 5000 loops
});

test("timings are totals across loops", () => {
  const root = parseExplain(explainPayload);
  const indexScan = root.children[1];
  expect(indexScan.totalMs).toBeCloseTo(750, 5); // 0.15 ms × 5000
});

test("self time subtracts children and never goes negative", () => {
  const root = parseExplain(explainPayload);
  // 820 total − (20 seq scan + 750 index scan) = 50 ms in the join itself
  expect(root.selfMs).toBeCloseTo(50, 5);
  for (const n of flatten(root)) expect(n.selfMs).toBeGreaterThanOrEqual(0);
});

test("the worst self-time node is the looped inner scan, not the root", () => {
  const root = parseExplain(explainPayload);
  const worst = worstSelfTime(root);
  expect(worst.nodeType).toBe("Index Scan");
  expect(worst.relation).toBe("customers");
});

test("estimate error is symmetric and ≥ 1", () => {
  const under = parseExplain([
    { Plan: { "Node Type": "Seq Scan", "Plan Rows": 1, "Actual Rows": 100, Loops: 1 } },
  ]);
  const over = parseExplain([
    { Plan: { "Node Type": "Seq Scan", "Plan Rows": 100, "Actual Rows": 1, Loops: 1 } },
  ]);
  expect(estimateError(under)).toBeCloseTo(100, 5);
  expect(estimateError(over)).toBeCloseTo(100, 5);
  const exact = parseExplain([
    { Plan: { "Node Type": "Seq Scan", "Plan Rows": 42, "Actual Rows": 42, Loops: 1 } },
  ]);
  expect(estimateError(exact)).toBe(1);
});

test("an empty scan does not blow up the error ratio", () => {
  const empty = parseExplain([
    { Plan: { "Node Type": "Seq Scan", "Plan Rows": 0, "Actual Rows": 0, Loops: 1 } },
  ]);
  expect(Number.isFinite(estimateError(empty))).toBe(true);
  expect(estimateError(empty)).toBe(1);
});

test("the worst estimate is found anywhere in the tree, not just at the root", () => {
  const skewed: RawNode = {
    "Node Type": "Hash Join",
    "Plan Rows": 100,
    "Actual Rows": 100,
    "Actual Total Time": 10,
    Loops: 1,
    Plans: [
      {
        "Node Type": "Seq Scan",
        "Relation Name": "events",
        "Plan Rows": 10,
        "Actual Rows": 10_000, // 1000× underestimate, deep in the tree
        "Actual Total Time": 5,
        Loops: 1,
      },
    ],
  };
  const worst = worstEstimate(parseExplain([{ Plan: skewed }]));
  expect(worst.relation).toBe("events");
  expect(estimateError(worst)).toBeCloseTo(1000, 5);
});

test("per-loop estimates are scaled too, so a correct loop plan reads as error 1", () => {
  // Plan Rows 1 / Actual Rows 1 over 5000 loops is a perfect estimate — it must
  // not look like a 5000× error just because the totals were scaled.
  const root = parseExplain(explainPayload);
  expect(estimateError(root.children[1])).toBe(1);
});
