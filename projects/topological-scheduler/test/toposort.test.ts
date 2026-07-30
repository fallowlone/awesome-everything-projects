import { test, expect } from "bun:test";
import { topoSort, batches, CycleError } from "../src/toposort";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Assert that every edge [a,b] has a before b in the result. */
function assertOrder(result: string[], edges: Array<[string, string]>): void {
  for (const [a, b] of edges) {
    const ai = result.indexOf(a);
    const bi = result.indexOf(b);
    expect(ai).toBeGreaterThanOrEqual(0); // both nodes present
    expect(bi).toBeGreaterThanOrEqual(0);
    expect(ai).toBeLessThan(bi);          // a before b
  }
}

// ── (a) edge ordering ─────────────────────────────────────────────────────────

test("every edge [a,b] has a before b in the output", () => {
  const nodes = ["compile", "link", "test", "package"];
  const edges: Array<[string, string]> = [
    ["compile", "link"],
    ["link", "test"],
    ["test", "package"],
  ];
  const result = topoSort(nodes, edges);
  assertOrder(result, edges);
});

test("all nodes appear exactly once including disconnected ones", () => {
  const nodes = ["build", "lint", "docs"]; // docs has no edges
  const edges: Array<[string, string]> = [["build", "lint"]];
  const result = topoSort(nodes, edges);
  expect(result).toHaveLength(nodes.length);
  expect([...new Set(result)]).toHaveLength(nodes.length); // no duplicates
  expect(result).toContain("docs");
});

// ── (b) all nodes present, no duplicates ─────────────────────────────────────

test("disconnected nodes all appear in output with no duplicates", () => {
  const nodes = ["a", "b", "c", "d", "e"];
  // Only a→b and c→d; e is fully disconnected.
  const edges: Array<[string, string]> = [["a", "b"], ["c", "d"]];
  const result = topoSort(nodes, edges);
  expect(result).toHaveLength(5);
  expect(new Set(result).size).toBe(5);
  assertOrder(result, edges);
});

// ── (c) cycle throws CycleError ───────────────────────────────────────────────

test("a two-node cycle throws CycleError with both nodes in cycleNodes", () => {
  expect(() => topoSort(["a", "b"], [["a", "b"], ["b", "a"]])).toThrow(CycleError);
  try {
    topoSort(["a", "b"], [["a", "b"], ["b", "a"]]);
  } catch (err) {
    expect(err).toBeInstanceOf(CycleError);
    const ce = err as CycleError;
    expect(ce.cycleNodes).toContain("a");
    expect(ce.cycleNodes).toContain("b");
  }
});

test("a three-node cycle throws CycleError naming all cycle members", () => {
  // x→y→z→x; upstream node u is NOT part of the cycle.
  expect(() =>
    topoSort(["u", "x", "y", "z"], [["u", "x"], ["x", "y"], ["y", "z"], ["z", "x"]])
  ).toThrow(CycleError);
  try {
    topoSort(["u", "x", "y", "z"], [["u", "x"], ["x", "y"], ["y", "z"], ["z", "x"]]);
  } catch (err) {
    const ce = err as CycleError;
    // u is NOT in the cycle — only x, y, z are trapped
    expect(ce.cycleNodes).not.toContain("u");
    expect(ce.cycleNodes).toContain("x");
    expect(ce.cycleNodes).toContain("y");
    expect(ce.cycleNodes).toContain("z");
  }
});

// ── (d) self-loop throws CycleError ──────────────────────────────────────────

test("a self-loop throws CycleError naming that node", () => {
  expect(() => topoSort(["a", "b"], [["a", "a"]])).toThrow(CycleError);
  try {
    topoSort(["a", "b"], [["a", "a"]]);
  } catch (err) {
    const ce = err as CycleError;
    expect(ce.cycleNodes).toContain("a");
  }
});

// ── (e) deterministic tie-break ───────────────────────────────────────────────

test("tie-break is lexicographic: no-edge nodes return alphabetically sorted", () => {
  // No edges — all nodes eligible from the start.
  const result = topoSort(["c", "a", "b"], []);
  expect(result).toEqual(["a", "b", "c"]);
});

test("exact deterministic output for a known 6-node graph", () => {
  // Graph:
  //   build → lint → report
  //   build → test → report
  //   docs  (disconnected)
  //
  // Level 0: build, docs  (tie → lex: build, docs)
  // Level 1: lint, test   (tie → lex: lint, test)
  // Level 2: report
  //
  // Expected linear order: build, docs, lint, test, report
  const nodes = ["build", "lint", "test", "report", "docs", "setup"];
  const edges: Array<[string, string]> = [
    ["setup", "build"],
    ["build", "lint"],
    ["build", "test"],
    ["lint", "report"],
    ["test", "report"],
  ];
  // Level 0: docs, setup (no deps) → lex: docs, setup
  // After setup: build → level 1: build, docs  (docs had 0 deps, released at start)
  // Actually let's re-derive:
  //   in-degrees: setup=0, docs=0, build=1(setup), lint=1(build), test=1(build), report=2
  //   Step 0 eligible: docs, setup → lex → [docs, setup]
  //   Process docs: nothing unlocked. Process setup: build (in-deg 0 now)
  //   Step 1 eligible: build → [build]
  //   Process build: lint(0), test(0) → Step 2 eligible: lint, test → lex → [lint, test]
  //   Process lint: report(1). Process test: report(0) → Step 3: [report]
  // Final: docs, setup, build, lint, test, report
  const result = topoSort(nodes, edges);
  expect(result).toEqual(["docs", "setup", "build", "lint", "test", "report"]);
  assertOrder(result, edges);
});

// ── (f) batches: independent nodes share a batch ─────────────────────────────

test("batches: independent nodes are in the same batch", () => {
  // A→D, B→D, C→D  (A,B,C independent; D depends on all)
  const nodes = ["A", "B", "C", "D"];
  const edges: Array<[string, string]> = [["A", "D"], ["B", "D"], ["C", "D"]];
  const result = batches(nodes, edges);
  expect(result.length).toBeGreaterThanOrEqual(2);
  // First batch must contain A, B, C (they are independent)
  const batch0 = result[0];
  expect(batch0).toContain("A");
  expect(batch0).toContain("B");
  expect(batch0).toContain("C");
  // D must be in a later batch
  const dBatchIndex = result.findIndex((b) => b.includes("D"));
  expect(dBatchIndex).toBeGreaterThan(0);
});

test("batches: a dependent node is in a strictly later batch than its dependency", () => {
  // pipeline: compile → link → run
  const nodes = ["compile", "link", "run"];
  const edges: Array<[string, string]> = [["compile", "link"], ["link", "run"]];
  const result = batches(nodes, edges);
  const idxCompile = result.findIndex((b) => b.includes("compile"));
  const idxLink = result.findIndex((b) => b.includes("link"));
  const idxRun = result.findIndex((b) => b.includes("run"));
  expect(idxCompile).toBeLessThan(idxLink);
  expect(idxLink).toBeLessThan(idxRun);
});
