# Topological build scheduler

Build a DAG-based task scheduler — like Make or a CI pipeline — that orders jobs by dependency, detects cycles before they deadlock, and identifies which tasks can run in parallel.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** algorithms, engineering-practice

## Deliverable

A scheduler that takes a task graph, emits a deterministic topological order (Kahn's algorithm with lexicographic tie-break), throws a typed CycleError naming the offending cycle on any cyclic input, and groups independent tasks into parallel batches.

## Why this project

Topological sorting is the foundation of every build system, CI pipeline, and package installer. This project forces you past the textbook definition: you must make the sort deterministic (non-determinism silently breaks CI caches), surface cycle errors with enough information to actually fix the manifest, and extend the linear order into a parallel batch schedule that a real runner can execute with Promise.all. The result is a scheduler you could drop into a Makefile replacement.

## Skills

- topological sort
- Kahn's algorithm
- in-degree tracking
- cycle detection
- DAG parallelism

## Milestones

### 1. Model the task graph

Before any sorting, decide what a task graph is and what operations it must support. A build graph is a directed acyclic graph (DAG): nodes are tasks, edges encode 'A must finish before B' (a→b means A is a prerequisite of B). The representation matters: an adjacency list over a node set scales better than a matrix for sparse build graphs (most tasks depend on a handful of others, not every other task). Model two auxiliary structures you will need in every subsequent milestone: the in-degree map (how many prerequisites does each task still have?) and the adjacency list (given a completed task, which tasks does it unlock?). Both must be computed in O(V+E). Disconnected nodes — tasks with no dependencies and no dependents — are valid and must not be silently dropped. Expose a clean constructor that accepts nodes as a string array and edges as [predecessor, successor] pairs, validates that every edge's endpoint is a declared node, and throws on unknown endpoints.

**Definition of done:**

- In-degree map and adjacency list are computed in O(V+E), and disconnected nodes appear in both with in-degree 0 and empty adjacency.
- The constructor throws a descriptive error when an edge references a node not in the declared node set.

**Self-review:** Walk through the in-degree and adjacency structures for a 5-node graph with 4 edges and two disconnected nodes; a senior reviewer checks both structures cover all nodes, in-degree is exact, and you can name the complexity of building each.

### 2. Topological sort via Kahn's algorithm

Implement Kahn's algorithm: seed a queue with every zero-in-degree node, repeatedly dequeue a node into the result and decrement the in-degree of its successors — if a successor reaches zero, enqueue it. This is O(V+E) and iterative, with no recursion stack overflow risk. The critical insight is that this algorithm is inherently non-deterministic when multiple nodes are simultaneously eligible (zero in-degree): in a real build system, non-determinism means rebuilds produce different orders, caching breaks, and CI is unreproducible. Fix it by using a min-heap or by sorting zero-in-degree candidates lexicographically before processing — the order is stable, cheap (extra O(k log k) per step where k is the number of ties), and makes the output a pure function of the graph. The result must contain every node exactly once, including disconnected ones.

**Definition of done:**

- For every edge [a, b] in the input, a appears before b in the output array, and all nodes (including disconnected ones) appear exactly once.
- The sort is deterministic: for a fixed graph, repeated calls return the identical array, and you can state which tie-breaking rule is used.

**Self-review:** Given a diamond dependency (D depends on B and C, both depend on A), trace the queue state after each dequeue step and confirm B and C are processed in a stable order; a senior reviewer checks you explain why non-determinism breaks incremental build caches.

### 3. Cycle detection and typed CycleError

Kahn's algorithm gives you cycle detection for free: if the result after processing all zero-in-degree nodes contains fewer nodes than the input, at least one cycle exists — the nodes missing from the result are exactly those trapped in a cycle (all their predecessors were also in cycles, so their in-degree never reached zero). This is a significant advantage over DFS-based detection: you get the cycle nodes at no extra cost. But 'cycle detected' is not a useful error. A build system must tell the operator which tasks are mutually blocking — so the CycleError must expose the set of nodes involved in the cycle, not just a boolean. For a self-loop (a→a), the message must name that node; for a two-node cycle (a→b→a), both must appear. Make CycleError a typed class that extends Error, carries a cycleNodes field, and is exported so callers can instanceof-check it and extract the cycle for display.

**Definition of done:**

- Any cyclic input (including self-loops) throws a CycleError (not a generic Error), and the cycleNodes field contains exactly the nodes trapped in the cycle.
- CycleError extends Error and is a named export so callers can catch and instanceof-check it independently from other errors.

**Self-review:** For the graph a→b→c→b (c and b form a cycle, a is upstream), trace which nodes remain in the in-degree map after the algorithm halts and explain why a is not in cycleNodes; a senior reviewer checks you derived the cycle nodes from the leftover set, not from a separate DFS pass.

### 4. Prove determinism with an exact-output test

Determinism is not a property you assume — it is a property you prove with a test that asserts the exact output for a known graph. Pick a non-trivial graph (at least 6 nodes, at least 2 tie-break situations), compute the expected topological order by hand using your lexicographic tie-break rule, and write a test that hard-codes that expected array. If the output changes, the test breaks. This disciplines future refactors: if you change the tie-break rule, you must update the expected output, which forces you to think about whether the change breaks reproducibility. Also test the edge of the tie-break rule itself: given nodes ['c','a','b'] with no edges, the sort must return ['a','b','c'], not the insertion order. Document the tie-break rule in a comment near the implementation so the intent is explicit and not lost the next time someone refactors the queue.

**Definition of done:**

- A test hard-codes the expected output for a ≥6-node graph and passes; changing the tie-break logic breaks that test.
- A separate test proves that nodes with equal precedence are returned in lexicographic order, regardless of their declaration order.

**Self-review:** Show the 6-node graph you chose, derive the expected order step by step using the tie-break rule, and name one scenario where a different tie-break (insertion order, random) would break a CI cache hit; a senior reviewer checks the expected array in the test matches your derivation exactly.

### 5. Parallel batching: group tasks by dependency level

A linear order is the minimum the scheduler must provide, but a real build system runs as many tasks in parallel as the graph allows. The batches extension of Kahn's algorithm gives you this for free: instead of enqueueing zero-in-degree nodes one by one, collect all nodes whose in-degree hits zero in the same round into one batch — that batch is the set of tasks that can run in parallel at that level. Process each batch as a unit, then decrement in-degrees, collect the next batch, and repeat. The result is a list of batches (string arrays), where tasks within a batch have no dependency on each other and every task in batch k+1 depends on at least one task in batch 1…k. This is the wave-front / level-synchronous model used by make -j and most CI engines. Prove it: two tasks with no path between them must land in the same batch; a task that depends on one of them must land in a strictly later batch.

**Definition of done:**

- The batches() function returns a list of batches where tasks within each batch are independent (no edge between any two tasks in the same batch), and tasks in later batches have all their dependencies satisfied by earlier batches.
- A test proves that two disconnected nodes land in the same batch and a node depending on one of them lands in a strictly later batch.

**Self-review:** Given a pipeline A→B→D and a sidecar C→D, enumerate the expected batches (batch 0: {A,C}, batch 1: {B}, batch 2: {D}) and explain why running D before B in the same batch would be wrong; a senior reviewer checks your batches() implementation does not re-sort per-batch differently from the linear sort's tie-break.

### 6. Wire it into a real build runner

The algorithm is proven; now make it a useful tool. Build a thin runner that accepts a task manifest (JSON mapping task names to arrays of commands and dependency names), resolves the execution order via topoSort, dispatches each batch concurrently (Promise.all over the batch), and streams structured JSON output per task (name, status, stdout, durationMs). The runner must reject the manifest and surface a readable error if topoSort throws CycleError — naming the cycle so the operator can fix the manifest without reading stack traces. It must also validate that every dependency name in the manifest references a declared task (unknown dependency = fail fast at load time, not at run time). Make the runner testable by injecting the executor function (the thing that actually runs a shell command), so tests can assert scheduling behaviour without spawning real processes. Measure the wall-clock speedup of the batched runner versus sequential on a synthetic 20-task diamond graph.

**Definition of done:**

- A manifest with a cycle produces a human-readable error naming the cycle nodes (not a raw stack trace), and a manifest with an unknown dependency fails at load time.
- A test injects a mock executor and verifies that tasks in the same batch are started before any task in the next batch is started, without spawning real processes.

**Self-review:** Paste the structured JSON output for a 3-task chain and explain how the injected executor lets you unit-test scheduling order without spawning processes; a senior reviewer checks the CycleError surface includes cycle node names and that unknown-dependency validation fires at load time, not mid-run.

## Rubric

### Topological order correctness

- **Junior:** A DFS-based sort returns a valid order for small acyclic graphs; disconnected nodes may be silently dropped; behaviour on cycles is undefined or crashes with a stack overflow.
- **Mid:** Kahn's algorithm processes all nodes (including disconnected ones) in O(V+E), produces a valid topological order for every DAG, and throws CycleError on any cyclic input including self-loops.
- **Senior:** The sort is deterministic under a documented tie-break rule (lexicographic or priority), proven by a hard-coded expected-output test; you can explain why non-determinism breaks CI caches and name the O(k log k) per-level cost of the tie-break.

### Cycle detection and error reporting

- **Junior:** Cycles cause an infinite loop or a generic Error with no information about which tasks are involved; the caller cannot distinguish a cycle from other errors.
- **Mid:** Kahn's leftover set identifies cycle members at no extra cost; a typed CycleError class (extends Error, exports cycleNodes) lets callers catch and inspect the cycle without parsing the message string.
- **Senior:** The error surfaces in the build runner as a human-readable message naming the cycle nodes (not a stack trace) so an operator can fix the task manifest; you can argue why the leftover-set approach is preferable to a separate Tarjan/DFS cycle-extraction pass.

### Determinism and parallel batching

- **Junior:** The sort output order varies across runs or depends on insertion order; no parallel grouping is attempted.
- **Mid:** A stable tie-break makes the output a pure function of the graph; batches() groups tasks whose in-degree reaches zero in the same Kahn round, and tests verify that independent tasks share a batch while their dependents are in a later batch.
- **Senior:** The parallel runner executes each batch with Promise.all, measures wall-clock speedup versus sequential, and rejects manifests with cycles or unknown dependencies at load time with a user-actionable error — not a mid-run crash.

## Senior stretch

- Implement Tarjan's SCC algorithm alongside Kahn's and compare their cycle-detection outputs: Kahn gives you the set of cycle-member nodes in O(V+E); Tarjan gives you each strongly connected component as a distinct group. Prove they agree on cycle membership and argue when Tarjan's granularity (per-SCC, not per-graph) is worth the extra implementation complexity.
- Add a priority weight to each node and change the tie-break from lexicographic to priority-descending (lexicographic as a secondary key). Prove with a test that a high-priority node jumps ahead of a same-level low-priority peer, and reason about whether this still produces a valid topological order.
- Extend the parallel runner to honour a concurrency cap (at most N tasks running simultaneously across all batches), and prove under test that the cap is never exceeded even when a batch has more tasks than the cap allows.
- Implement incremental re-scheduling: given a completed run and a set of changed nodes, compute the minimal subgraph that must be re-run (the changed nodes plus all transitive dependents) without re-running tasks whose inputs are unchanged. This is the core of Make's rebuild logic.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/topological-scheduler
