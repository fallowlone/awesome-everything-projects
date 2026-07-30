// TODO(you): implement topological sort (Kahn's algorithm) with cycle detection.
//
// `topoSort(nodes, edges)` — returns a topological ordering of `nodes`.
// - edge [a, b] means a must come before b.
// - Tie-break: when multiple nodes are eligible at the same step, process them
//   in lexicographic (ascending) order so the output is deterministic.
// - All nodes must appear in the result exactly once, including disconnected ones.
// - Throws `CycleError` (exported) on any cycle, including self-loops.
//   `CycleError` must expose a `cycleNodes` field with the nodes trapped in the cycle.
//
// `batches(nodes, edges)` — optional extension.
// Returns `string[][]` where each inner array is a batch of tasks that can run
// in parallel at that level. Batch k+1 tasks all depend on tasks in batches 0..k.

export class CycleError extends Error {
  cycleNodes: string[];
  constructor(cycleNodes: string[]) {
    super(`Cycle detected among nodes: ${cycleNodes.join(", ")}`);
    this.name = "CycleError";
    this.cycleNodes = cycleNodes;
    // TODO: remove this line and implement the body above once you're ready.
    void cycleNodes;
  }
}

export function topoSort(nodes: string[], edges: Array<[string, string]>): string[] {
  void nodes; void edges;
  // TODO: build in-degree map and adjacency list, then run Kahn's algorithm.
  // Use lexicographic order to break ties among zero-in-degree nodes.
  // Throw CycleError with the leftover nodes if the result is shorter than nodes.
  return [];
}

export function batches(nodes: string[], edges: Array<[string, string]>): string[][] {
  void nodes; void edges;
  // TODO (optional): collect all zero-in-degree nodes per Kahn round into one batch.
  // Return a list of batches; tasks within a batch may run in parallel.
  return [];
}
