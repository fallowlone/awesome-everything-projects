# Union-Find (Disjoint Set Union)

Build a disjoint-set structure from a naive parent array up to near-constant amortized time — then use it to drive Kruskal's MST algorithm on a weighted graph.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** algorithms, distributed

## Deliverable

A DSU class with union by rank and path compression whose find and union run in amortized O(α(n)), plus a Kruskal implementation that uses it to find the MST of a weighted graph in O(E log E).

## Why this project

Union-Find (Disjoint Set Union) is one of the most elegant data structures in computer science: three lines of path compression turn an O(n) chain traversal into an amortized near-constant operation, and the combination with union by rank yields the inverse Ackermann time bound — effectively O(1) for any input you will ever encounter. It is also one of the most widely applied: Kruskal's MST, dynamic connectivity, image segmentation, network clustering, and percolation all reduce to 'are these two elements in the same component?' The project forces you to understand not just the implementation but the amortized analysis that justifies why the optimizations compose so powerfully.

## Skills

- disjoint set union
- union by rank
- path compression
- amortized analysis
- Kruskal MST

## Milestones

### 1. Naive parent array: find by walking up, union by pointer

Start with the simplest correct implementation: an array `parent` where `parent[i]` is the representative of element i, or i itself when i is a root. `find(x)` walks parent pointers until it hits a root — this can take O(n) steps in the worst case when the structure degenerates into a chain (union always appending to the tail). `union(a, b)` calls find on both, then points one root at the other. `connected(a, b)` returns whether find(a) === find(b). `count()` tracks the number of disjoint sets. Build and test this version first: get every invariant right before any optimization obscures the logic. Two elements are in the same component if and only if their find values are equal — that is the single axiom you will preserve through all later changes.

**Definition of done:**

- A fresh DSU(n) reports count()===n, and no pair of distinct elements is connected until a union is performed.
- After union(a, b), connected(a, b) is true and count() is n-1; a second union on two already-connected elements leaves count() unchanged.

**Self-review:** Show the worst-case find chain and the O(n) path it walks; a senior reviewer checks the union correctly updates count only when the roots differ, and that the naive version has no hidden optimization yet.

### 2. Union by rank: keep trees shallow

The naive union always attaches one root under the other arbitrarily, so a sequence of n-1 unions can build a chain of depth n-1, turning each find into an O(n) traversal. Union by rank prevents this: each node carries a `rank` (an upper bound on its subtree height), initialized to 0. When merging two trees, point the root of lower rank under the root of higher rank so the combined tree is at most as deep as the deeper one. When ranks tie, promote one (arbitrarily, say b under a) and increment a's rank by one. This guarantees that a tree of rank k contains at least 2^k nodes, so the maximum depth of any tree on n elements is O(log n) — find is now O(log n) in the worst case, not O(n). Carry the rank array alongside parent; ranks never decrease and never change once a node loses its root status.

**Definition of done:**

- A sequence of n-1 unions never produces a tree deeper than O(log n) — verify by inspecting tree height after building an adversarial chain with the naive version vs union-by-rank.
- Rank only increases when two trees of equal rank merge, and a node's rank never changes once it is no longer a root.

**Self-review:** Construct the worst case for union-by-rank (equal-rank merges at every step) and show the resulting tree depth is O(log n); a senior reviewer checks rank is an upper bound on height, not an exact height.

### 3. Path compression: flatten the traversal path

Union by rank bounds tree height at O(log n), but we can do better: every time find(x) traverses a chain to reach the root r, reassign the parent of every node on that chain directly to r. This is path compression (or 'full path compression' / 'path halving' — either is acceptable). The next find call on any of those nodes is O(1) because they now point directly to the root. Path compression does not change ranks — ranks remain static upper bounds and the tree height is not recalculated. The combined effect of union by rank and path compression yields an amortized cost per operation of O(α(n)), where α is the inverse Ackermann function — for all practical values of n (up to 2^65536), α(n) ≤ 5. This is as close to constant as any known data structure with the same expressiveness.

**Definition of done:**

- After find(x) on a deep chain, every node on the path to the root now points directly to the root (verify by inspecting parent[] after the call).
- The representative returned by find(x) remains stable and correct across multiple union and find calls — path compression must not corrupt the partition.

**Self-review:** Show the parent[] array before and after find() on a chain of length 5; a senior reviewer checks every intermediate node's parent is now the root, and that repeated find() calls are O(1) thereafter.

### 4. Connectivity queries: count, connected, stress test

With both optimizations in place, verify the public contract under adversarial inputs. `connected(a, b)` is simply `find(a) === find(b)` — never call it by walking the tree manually. `count()` must decrement by exactly 1 on each union of two previously disconnected elements, and stay unchanged if they were already connected. Build a stress test: start with n=1000 elements, apply random unions, and after each batch assert that count equals n minus the number of successful unions (those that actually merged two distinct sets). This is the invariant that catches off-by-one errors in union's guard condition. Also verify transitivity explicitly: after union(0,1) and union(1,2), connected(0,2) must be true even though 0 and 2 were never directly united.

**Definition of done:**

- Transitivity holds: after union(0,1) and union(1,2), connected(0,2) is true; after building two components of 3 elements each from 6 elements, count()===2.
- Union of two already-connected elements does not decrement count() — the guard condition fires correctly.

**Self-review:** Walk through union(2, 5) when 2 and 5 are already in the same component: show the find calls, the root comparison, and the no-op branch; a senior reviewer checks count() is not decremented and no rank change occurs.

### 5. Amortized analysis: measuring O(α(n)) in practice

The inverse Ackermann bound is not just a theoretical curiosity — prove it empirically. Run a benchmark: for n in [1000, 10 000, 100 000, 1 000 000], perform n random unions followed by n random finds and measure total time. If your implementation is correct, time should grow nearly linearly with n (not n log n from the rank-only version). The crucial verification is that path compression is actually firing: after a batch of finds on a structure built by adversarial sequential unions, inspect that the average parent-chain length has collapsed to near 1. This exercise also reveals the difference between worst-case and amortized analysis: a single find on a fresh chain can still be O(log n), but amortized over a sequence of m operations on n elements the total is O(m α(n)) — the amortization is over the sequence, not the single call.

**Definition of done:**

- A benchmark over four orders of magnitude shows time growing near-linearly, and you can state the amortized bound O(α(n)) versus the worst-case single-call bound O(log n).
- After a batch of finds on an adversarially built structure, the average parent-chain length is ≤ 2 — confirming path compression has flattened the tree.

**Self-review:** Explain why α(n) ≤ 5 for all practical n, and why time per operation 'feels' constant; a senior reviewer checks you distinguish amortized-per-sequence from worst-case-per-call and can name a real scenario where a single find is still slow (first access after many sequential unions).

### 6. Application: Kruskal's MST (or percolation threshold)

Apply the DSU to a real problem. Kruskal's algorithm finds the minimum spanning tree of a weighted undirected graph in O(E log E): sort all edges by weight, then iterate; for each edge (u, v, w), if u and v are in different components (not connected), add the edge to the MST and union(u, v). Stop when count() equals 1 (all nodes connected) or all edges are exhausted. The DSU is the only reason Kruskal is efficient — the connectivity check and the merge are both near-O(1). Alternatively (or additionally), implement a percolation simulation: on an n×n grid, open sites one by one in random order and use DSU to detect the first moment the top row and bottom row become connected — this is the percolation threshold, and it is the classic demonstration that DSU makes an otherwise O(n^4) simulation run in O(n^2 α(n^2)).

**Definition of done:**

- Kruskal's algorithm produces the correct MST weight on at least three hand-crafted graphs, including a disconnected graph where the MST spans only the connected component.
- You can state the overall complexity of Kruskal's with DSU (O(E log E) dominated by sort, not by the union-find operations) and explain why the DSU's near-O(1) makes this hold.

**Self-review:** Walk Kruskal's on a 5-node, 7-edge weighted graph step by step, showing each find pair and union call; a senior reviewer checks that you skip the edge when both endpoints are already connected and that the MST contains exactly n-1 edges for a connected graph.

## Rubric

### Find/union correctness

- **Junior:** DSU initializes correctly, find walks to the root, union links roots, and connected compares find results — but no optimizations, so adversarial inputs degrade to O(n) per operation.
- **Mid:** Both union by rank and path compression are implemented and compose correctly: find returns a stable representative, count() tracks merges exactly, and connected is never implemented by manually re-walking the tree.
- **Senior:** You can prove that the two optimizations are orthogonal (path compression doesn't affect rank semantics), explain the amortized O(α(n)) bound from first principles, and identify one scenario where find is still expensive (first access on a deep chain before any compression fires).

### Balancing (union by rank/size)

- **Junior:** Union always points one root under the other without considering depth — a chain of unions produces a degenerate linear tree.
- **Mid:** Union attaches the lower-rank root under the higher-rank one; ranks increment only when equal-rank roots merge; the resulting tree height is O(log n) provably.
- **Senior:** You can construct the worst-case rank sequence (all equal-rank merges), show it reaches height log₂ n, and argue why ranks are an upper bound on height rather than the exact height — especially after path compression has flattened subtrees without updating their ranks.

### Path compression and amortized complexity

- **Junior:** No path compression — repeated finds on the same deep chain are each O(depth).
- **Mid:** Full path compression (or path halving) fires during find, and the parent array is visibly flatter after the first traversal — subsequent finds on the same nodes are O(1).
- **Senior:** You can demonstrate the amortized bound empirically (near-linear scaling with n), name the inverse Ackermann function α(n) and its practical bound ≤ 5, and explain why the combination of rank and compression is strictly better than either alone — rank bounds depth so compression rarely encounters long chains; compression makes most future finds trivial.

## Senior stretch

- Implement union by size instead of union by rank (attach the smaller tree under the larger by node count, not estimated height) and prove that both yield O(log n) tree height — explain why size is often preferable in practice for weighted union heuristics.
- Implement a rollback-capable DSU (link-by-rank without path compression) for use in offline algorithms: union operations can be undone in reverse order by restoring the parent and rank arrays via a stack — prove correctness and state why path compression breaks rollback.
- Add weighted edges to the DSU ('small-to-large' or 'union with potential') so that find returns not just the representative but also the accumulated weight of the path from x to its root — use this to solve 'sum of elements in the same set' queries in O(α(n)) per query.
- Apply DSU to dynamic connectivity: given a sequence of edge additions and connectivity queries offline, use the link-cut tree or a persistent DSU (with rollback) to answer all queries in O((n + q) log n) rather than O(n·q) naive per-query BFS.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/union-find
