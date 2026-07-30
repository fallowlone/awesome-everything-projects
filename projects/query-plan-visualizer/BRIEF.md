# Query plan visualizer

Paste an EXPLAIN (ANALYZE, FORMAT JSON) and render the plan tree with per-node timing and row-estimate error, so a bad join jumps out visually.

**Difficulty:** intermediate · **Est. days:** 5 · **Stack:** — · **Tracks:** databases

## Deliverable

A web app that turns EXPLAIN JSON into an annotated, collapsible plan tree highlighting the worst node.

## Why this project

Reading a raw EXPLAIN JSON is the database equivalent of reading a minified bundle: the information is all there, but the structure is hostile. This project forces you to understand the plan format deeply enough to render it — which means you have to handle loop counts correctly (actual rows in a nested-loop child are per-loop, not total), compute self-time from the difference between a node's total time and its children's, and choose a meaningful definition of 'worst node' that is neither just the most expensive nor just the most surprising. The payoff is practical: every senior engineer who optimises queries eventually builds or reaches for exactly this tool, and building it yourself makes the underlying plan semantics unforgettable.

## Skills

- EXPLAIN JSON parsing
- tree layout
- estimate-vs-actual diffing

## Milestones

### 1. Parse EXPLAIN JSON to a tree

Parse EXPLAIN JSON into a node tree.

**Definition of done:**

- EXPLAIN (ANALYZE, FORMAT JSON) is parsed into a node tree preserving parent/child structure and node types.
- Malformed or non-JSON input fails with a clear message, not a crash.

### 2. Per-node actual vs planned

Render the tree with per-node actual vs planned rows.

**Definition of done:**

- Each node shows actual vs planned rows and its self-time; the tree is collapsible.
- Loop counts are accounted for so per-loop vs total rows aren't confused.

### 3. Surface the worst node

Highlight the node with the largest estimate error and the largest self-time.

**Definition of done:**

- The node with the largest estimate error (actual/planned) and the largest self-time are visually flagged.
- A correct plan with no large error shows no false alarm.

## Rubric

### Plan parsing correctness

- **Junior:** Parses the top-level node and displays node type, estimated cost, and planned rows for simple single-node plans.
- **Mid:** Recursively traverses Plans/children, preserves parent-child relationships across all scan and join node types, and handles plans with multiple child arrays (e.g. hash join's build vs probe sides) without conflating them.
- **Senior:** Correctly accounts for loop counts when computing per-node actual totals: a child inside a 1000-iteration nested loop reports per-loop rows, not total rows — conflating them produces an estimate-error that is 1000x wrong. Can explain the exact JSON fields used and why Loops must be factored in.

### Cost and timing attribution

- **Junior:** Displays the planner's Total Cost and Actual Total Time as-is from the JSON for each node.
- **Mid:** Computes self-time per node as Total Time minus the sum of children's Total Times, surfaces it alongside cumulative time, and shows planned vs actual rows so estimate error is immediately visible.
- **Senior:** Flags spilled nodes: hash or sort nodes where Batches > 1 indicate a work_mem spill to disk, commonly causing a 10-100x slowdown. Surfaces a suggested work_mem lower bound from Peak Memory Usage, or estimates it from the hash batch count when that field is absent.

### Worst-node surfacing

- **Junior:** Highlights the node with the highest Total Cost as the bottleneck.
- **Mid:** Computes two separate signals — largest estimate error (actual/planned rows, accounting for loops) and largest self-time — and surfaces each independently so the user sees both 'where time went' and 'where the planner was most wrong'.
- **Senior:** Avoids false alarms on trivially cheap nodes: an estimate error of 100x on a 0.01 ms node is noise; the severity score weights error magnitude by self-time. Articulates why a correct plan with no large estimate gap should show no flags, and tests this case explicitly.

## Senior stretch

- Detect spilled hash/sort nodes (Batches > 1) and suggest a work_mem target.
- Diff two plans (before/after a fix) side by side.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/query-plan-visualizer
