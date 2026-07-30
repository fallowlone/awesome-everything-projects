# Pathfinding Route Engine

Four search algorithms, one shared problem: get from A to B across a weighted grid. You'll build BFS, DFS, Dijkstra, and A* on a single graph model, then run them side by side and watch them disagree — DFS lunges into a dead end, BFS floods evenly, Dijkstra crawls outward by cost, A* leans toward the goal. This is where the algorithms unit stops being trivia and becomes a set of tools you choose between, with reasons.

**Difficulty:** intermediate · **Est. days:** 8 · **Stack:** TypeScript or Python, a binary-heap priority queue (hand-rolled or stdlib), node:test / pytest, a benchmarking harness (hyperfine or a timing loop) · **Tracks:** algorithms, base-cs

## Deliverable

A CLI that loads a grid (walls and weighted cells), runs any of BFS/DFS/Dijkstra/A* between two points, prints the path plus nodes-expanded and path-cost, and renders the explored frontier as ASCII so you can see how each algorithm searches.

## Why this project

Pathfinding is the cleanest place to feel why algorithm choice matters, because all four search strategies solve the identical problem yet behave completely differently — and the difference is not academic. The shape of the frontier, the number of nodes expanded, and whether the answer is even optimal all hinge on which structure you put at the frontier and whether you have a heuristic to lean on. Build them on one shared graph model and the relationships snap into focus: BFS is Dijkstra with all weights equal to one, A* is Dijkstra with a hint, DFS is the cautionary tale of optimizing for nothing in particular. Once you've watched A* carve a cone toward the goal where Dijkstra floods a disk, you stop memorizing these algorithms and start reaching for the right one — which is the entire point of the algorithms track.

## Skills

- modeling a grid as an adjacency-based weighted graph
- implementing BFS and DFS with explicit frontiers
- Dijkstra with a priority queue
- A* with an admissible heuristic
- reconstructing a path from a parent map
- instrumenting and benchmarking search algorithms

## Milestones

### 1. Model the world as a graph

Before any search, you need something to search. Represent the grid so that every algorithm can ask the same two questions: 'what are my neighbours?' and 'what does it cost to step there?'. Decide deliberately whether you store an explicit adjacency list or compute neighbours on the fly from (row, col) — for a dense grid the implicit form is leaner, but writing the explicit `neighbours(node)` function forces you to handle walls, the four-versus-eight-direction choice, and out-of-bounds edges in one honest place. Weighted cells (think mud costing 3, road costing 1) are what separate a real route engine from a maze toy, so bake cost into the edge from the start rather than bolting it on later.

**Definition of done:**

- A `neighbours(node)` function returns only in-bounds, non-wall cells with their step cost.
- A small grid (with at least one wall and one weighted region) loads from a text or array source and round-trips correctly.

### 2. BFS and DFS: the uninformed pair

Implement breadth-first and depth-first search and let the data structure be the whole lesson: a queue gives you BFS and the shortest path in number of steps; swap it for a stack and the exact same code becomes DFS, which finds *a* path but rarely the shortest. Track a `visited` set and a `parent` map as you go, because the parent map is how you reconstruct the actual route once the goal is reached — the search only tells you it's reachable. Run both on a grid with a wall in the middle and watch DFS dive deep into one corridor while BFS expands in rings; that contrast is the intuition the rest of the project builds on.

**Definition of done:**

- BFS returns a path with the minimum number of steps on an unweighted grid; DFS returns a valid (not necessarily shortest) path.
- Both reconstruct the path from a parent map and report it as an ordered list of cells, or report 'no path' cleanly when the goal is walled off.

### 3. Dijkstra: search that respects cost

BFS counts steps, but your grid has weighted cells, so the fewest-steps path and the cheapest path are no longer the same thing. Dijkstra fixes this by always expanding the cheapest-so-far node, which means a plain queue won't do — you need a priority queue keyed by accumulated cost. Implement it carefully: the classic bug is treating a node as final the first time you *see* it instead of the first time you *pop* it, which quietly produces wrong costs on graphs where a longer-hop route is cheaper. Keep a `dist` map and only update a neighbour when you've found a strictly cheaper way in. When it works, a detour through a road should beat a straight line through mud, and your printed path-cost should prove it.

**Definition of done:**

- On a weighted grid, Dijkstra returns the minimum-cost path, which differs from the BFS step-count path when weights vary.
- Nodes are finalized on pop, not on first sight, and the reported path-cost equals the sum of the edge weights along the path.

### 4. A*: aim with a heuristic

Dijkstra is correct but blind — it expands outward in every direction equally, wasting work on cells pointing away from the goal. A* is Dijkstra plus a hint: at each node it minimizes `g + h`, where `g` is the cost so far and `h` is an estimate of the cost remaining to the goal. On a grid, Manhattan distance is the natural heuristic for four-direction movement. The non-negotiable rule is that `h` must be *admissible* — it may never overestimate the true remaining cost — or A* can return a wrong path; this is the failure mode to test for deliberately, not just to read about. When it works you'll see it expand a narrow cone toward the goal instead of a full disk, and on the same map A* should expand strictly fewer nodes than Dijkstra while returning the identical optimal cost.

**Definition of done:**

- A* returns the same optimal-cost path as Dijkstra on weighted grids using an admissible heuristic.
- On at least one map, A* expands measurably fewer nodes than Dijkstra, and a test with an inadmissible heuristic visibly breaks optimality.

### 5. One CLI, four searches, honest numbers

Wire the four algorithms behind a single command so the only thing that changes between runs is which search you pick. Each run should print the same three facts — the path, the path-cost, and the number of nodes expanded — plus an ASCII render of the explored frontier so the differences are visible, not just numerical. This is where the project pays off: on one map BFS and Dijkstra agree because the weights are flat, on another they diverge, and A* matches Dijkstra's cost while touching fewer cells. Resist hardcoding the grid — read it from a file so you can craft adversarial maps (a long detour, a deceptive wall) that make each algorithm's character obvious.

**Definition of done:**

- `engine <algo> <map> <start> <goal>` runs any of the four and prints path, cost, and nodes-expanded consistently.
- At least two maps exist where the algorithms produce visibly different frontiers or costs, demonstrated in the output.

## Rubric

### Priority queue correctness

- **Junior:** Uses a built-in sort or a linear scan to find the minimum-cost node each step; Dijkstra and A* produce correct paths on small grids.
- **Mid:** Implements or wraps a binary-heap priority queue with O(log n) insert and extract-min; finalises nodes on pop (not on first sight) so costs are correct even when a cheaper path to an already-seen node is discovered later.
- **Senior:** Can demonstrate the classic pop-vs-visit bug on a concrete graph: a node seen at cost 10 via one path and cost 8 via a later path — if finalised on visit, the suboptimal cost is locked in. Knows when a decrease-key heap (Fibonacci heap) would reduce asymptotic complexity from O((V+E) log V) to O(E + V log V) and can state why it rarely wins in practice due to constant-factor overhead.

### Heuristic admissibility

- **Junior:** Uses Manhattan distance as the A* heuristic and observes that A* expands fewer nodes than Dijkstra on open maps.
- **Mid:** Can state the admissibility requirement (h(n) must never exceed the true remaining cost) and has a test where an inadmissible heuristic (e.g. Manhattan * 1.5) produces a suboptimal path on a specific map where the overestimate causes the wrong node to be expanded first.
- **Senior:** Explains consistency (monotone heuristic): h(n) <= cost(n, n') + h(n') for all edges, which guarantees the first time a node is expanded its cost is optimal — enabling lazy duplicate detection instead of a closed set. Can construct a grid where Manhattan is admissible but not consistent (it cannot happen in standard 4-directional grids, but can with variable edge costs) and explain the implication.

### Graph representation trade-off

- **Junior:** Stores the grid as a 2D array and computes neighbours on demand with hardcoded direction deltas.
- **Mid:** Separates the grid abstraction from the search algorithm via a `neighbours(node) -> [(node, cost)]` interface, making it possible to plug in a non-grid graph (e.g. a road network adjacency list) without changing any search code.
- **Senior:** Can argue when an explicit adjacency list beats implicit on-the-fly neighbour computation: dense grids with constant branching factor (4 or 8) favour implicit (no allocation per node); sparse graphs with variable out-degree or heterogeneous edge metadata favour explicit. Can estimate memory: a 1000x1000 grid with 4-connectivity stores 4M edges implicitly as arithmetic vs 4M explicit pointers (~32 MB at 8 bytes each).

## Senior stretch

- Add bidirectional search: grow two frontiers, one from the start and one from the goal, and stop when they meet. The payoff is real — searching to radius r from both ends touches far fewer nodes than searching to radius 2r from one — but the meeting condition and path-stitching are subtle, especially for the weighted and A* variants where 'they met' is not the same as 'the optimal path is found'.
- Build a real benchmark: generate randomized maps at several sizes and obstacle densities, run all algorithms under a timing harness, and report nodes-expanded and wall-clock time as a table. The goal is to make the textbook claims falsifiable — show where A*'s heuristic advantage shrinks (open maps, weak heuristics) and where Dijkstra's extra work is the price of having no hint.
- Make the heuristic pluggable and prove the theory: compare Manhattan, Euclidean, and a deliberately inadmissible (overestimating) heuristic on the same maps, and show how the inadmissible one trades optimality for speed — sometimes acceptably, sometimes not.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/pathfinding-route-engine
