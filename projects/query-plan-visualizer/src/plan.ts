// TODO(you): turn EXPLAIN (ANALYZE, FORMAT JSON) into a tree you can reason about.
//
// The trap the suite is built around: under a nested loop, `Actual Rows` and
// `Actual Total Time` are reported PER LOOP. Every number a human reads — row
// counts, timings, estimate error — must be the total. Skip the `× Loops` and the
// node executed 5,000 times looks like it returned one row in 0.15 ms, which is
// precisely the node you opened the visualiser to find.
export type RawNode = {
  "Node Type": string;
  Plans?: RawNode[];
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Actual Rows"?: number;
  "Actual Total Time"?: number;
  "Actual Startup Time"?: number;
  Loops?: number;
  "Relation Name"?: string;
};

export type PlanNode = {
  nodeType: string;
  relation?: string;
  planRows: number;
  actualRows: number;
  totalMs: number;
  selfMs: number;
  loops: number;
  children: PlanNode[];
};

export function parsePlan(raw: RawNode): PlanNode {
  void raw;
  throw new Error("TODO: build the node, scale by Loops, recurse into Plans");
}

/** Accept the array EXPLAIN returns, or a bare plan object. Throw on anything else. */
export function parseExplain(json: unknown): PlanNode {
  void json;
  throw new Error("TODO");
}

export function flatten(node: PlanNode): PlanNode[] {
  void node;
  return []; // TODO
}

/** Symmetric ratio ≥ 1: 100× under and 100× over are both "100× off". */
export function estimateError(node: PlanNode): number {
  void node;
  return 0; // TODO
}

export function worstEstimate(root: PlanNode): PlanNode {
  void root;
  throw new Error("TODO");
}

export function worstSelfTime(root: PlanNode): PlanNode {
  void root;
  throw new Error("TODO");
}
