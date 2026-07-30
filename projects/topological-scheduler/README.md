# Topological scheduler — starter

Implement `topoSort` and `CycleError` in `src/toposort.ts` so the suite passes.

    bun test

Rules: Kahn's algorithm, lexicographic tie-break among zero-in-degree nodes,
all nodes in output (including disconnected), throw `CycleError` (with `cycleNodes`)
on any cycle or self-loop. Optional: implement `batches()` for the parallel tests.
When green, extend to the runner milestone (see project rubric).
