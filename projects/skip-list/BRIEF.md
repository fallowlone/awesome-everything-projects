# Skip list

Build a probabilistic ordered data structure that delivers O(log n) search, insert, and delete without the rotation bookkeeping of balanced trees — just layered express lanes through a sorted linked list.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** typescript · **Tracks:** algorithms, databases

## Deliverable

A skip list with injected, deterministic coin-flip for level generation, correct ascending iteration, and a test suite that proves multi-level promotion, exact ordering, and O(log n) search wins over a linear scan on a tall list.

## Why this project

A skip list is the cleanest way to see probabilistic data structure design in action: you trade a balanced-tree's O(n) worst-case rotation work for a coin-flip that, in expectation, keeps every operation at O(log n). The injected-coin contract is the engineering lesson — any structure whose correctness depends on randomness must keep its RNG injectable so it can be tested deterministically. Building it from scratch forces you through the update-vector pattern (the single traversal that powers insert, delete, and search), the sentinel discipline that eliminates null checks, and the level-management bookkeeping that keeps currentLevel honest. Redis's sorted set (ZSET) uses a skip list internally for exactly these reasons: O(log n) ranked access, simple range scans, and no tree-rotation complexity.

## Skills

- probabilistic level generation
- sentinel nodes
- multi-level forward pointers
- ordered iteration
- expected O(log n) analysis

## Milestones

### 1. Nodes, sentinels, and the level layout

Before any search or insert logic, get the physical shape right. A skip list is a tower of sorted linked lists: level 0 is a complete list that every node participates in; level 1 contains roughly half the nodes; level k contains roughly 1/2^k. Each node carries an array of forward pointers, one per level the node reaches. Two sentinel nodes — head and tail — bracket every level so boundary checks collapse to pointer comparisons instead of null guards. Head's key is −∞, tail's is +∞; every non-sentinel node fits between them. The max-level cap (commonly 16 or 32) bounds both memory and the worst-case level-generation loop — without it a pathological coin sequence could allocate unboundedly. Sketch the node layout, the head/tail sentinels across all levels, and the invariant: level 0 is always a complete sorted chain, higher levels are sparse express lanes of the same ordering. This structural clarity prevents bugs later — a misaligned forward pointer at level 2 silently corrupts searches but is almost impossible to debug by looking at the output alone.

**Definition of done:**

- You can describe the node layout (key + forward[] of length = node's level) and draw a skip list of five keys showing all four structural levels, head and tail sentinels, and level-0 completeness.
- The SkipList class constructor accepts a coinFlip injection parameter (not Math.random) and a maxLevel cap; the sentinel invariant is enforced by construction and never re-checked at runtime.

**Self-review:** Walk the forward-pointer array at every level for a three-node list; a senior reviewer checks head[k] → first node at level k → sentinel tail[k] is a complete chain and that the level-0 chain contains every node with no gaps.

### 2. Probabilistic level generation and the coin-flip contract

The skip list's O(log n) expected cost rests entirely on randomness: if you bias the coin or make levels deterministic, the structure degenerates to a sorted linked list. The standard recipe — keep flipping an unbiased coin; stop at the first tail or when maxLevel is reached; the number of heads is the node's level — produces geometric distribution of heights, guaranteeing that the expected number of nodes at level k is n/2^k. The key engineering insight is that the coin-flip must be injected, not read from Math.random(), for two reasons: (1) tests must be deterministic and reproducible; (2) any code that bakes in a global RNG is untestable at unit granularity. Your coinFlip() → boolean parameter returns true (promote) or false (stop). A controlled flip sequence like [true, true, false, …] deterministically produces a three-level node, making multi-level assertions possible without fragility. The maxLevel cap matters for security: a caller who can bias the coin to always return true would cause an unbounded loop; a cap of 32 bounds the worst case to O(32) = O(1) level generation regardless of input.

**Definition of done:**

- randomLevel() uses only the injected coinFlip, never a global RNG, and respects maxLevel — proved by passing a coinFlip that always returns true and asserting the resulting level is exactly maxLevel.
- A test with a controlled flip sequence [true, true, false] produces a node at level 3, and a flip of [false] produces a node at level 1, confirming the geometric distribution at small scale.

**Self-review:** Show the randomLevel() implementation with no reference to Math.random, Date, or any global; a senior reviewer checks the stop condition (false from coinFlip OR level === maxLevel) and that the level is counted from 1, not 0.

### 3. Insert and search: the update-vector pattern

Search and insert share the same traversal skeleton, which is the core algorithmic move in a skip list. Starting at the highest level of head, you advance forward as long as the next node's key is strictly less than the target; when you can no longer advance, you drop one level and repeat. This two-dimensional walk — right then down — visits O(log n) nodes in expectation because each level acts as an express lane that skips over roughly half the nodes below. The update vector (an array of the last node visited at each level during a search) is what turns a pure search into an insert: after the walk, each update[k] points to the predecessor at level k, and splicing in the new node at its generated height is O(height) pointer swaps, each taking constant time. Without the update vector, every insert would require a second pass; with it, insert is a search plus a local splice. The same traversal pattern powers delete: find predecessors, check the target exists at level 0, then unlink it from every level where it appears.

**Definition of done:**

- insert(k) correctly splices the new node at every level up to its generated height using the update-vector pattern, and has(k) returns true for an inserted key and false for a key never inserted, verified by at least five distinct keys.
- The traversal visits only forward pointers (no backward scan) and the search path is strictly level-descending: it never revisits a level once dropped.

**Self-review:** Trace the update-vector walk for insert(7) into a list [1, 3, 5, 9] with a two-level structure and show which pointers change; a senior reviewer checks exactly two levels are updated for a two-level node and that the level-0 chain remains complete after the splice.

### 4. Delete: predecessor scan and multi-level unlinking

Delete is an insert in reverse: do the same update-vector walk, then check whether the node at update[0].forward[0] is the target — if it isn't (the key was never inserted), return false immediately with no structural change. If it is, unlink it from every level where it appears: for each level k from 0 to the node's height, set update[k].forward[k] = node.forward[k]. The tempting mistake is to unlink from all levels unconditionally; you must stop at the node's actual height, because above that the node has no forward pointer and its predecessors don't reference it. The subtlety of duplicate keys: if your insert silently ignores a duplicate (which is the right default for a set-like skip list), delete only has to handle the case where the key exists once or not at all. If you allow duplicates, the update vector's level-0 predecessor might point to the first duplicate and you delete only one instance — a valid and common implementation choice, but it must be documented. After deletion, if the list's effective height drops (all level-k nodes are gone), decrement currentLevel to avoid wasted traversal overhead on empty high levels.

**Definition of done:**

- delete(k) returns true and removes the node from all levels it occupied when k exists; it returns false and makes no structural change when k was never inserted; both are proved by calling has() and toArray() after each delete.
- After deleting the highest-level node, currentLevel decrements to reflect the new maximum level — the traversal does not waste iterations on empty high levels.

**Self-review:** Delete a node that sits at level 3 in a four-level list and show the exact pointer updates at each level; a senior reviewer checks that update at levels above the node's height are not touched and that currentLevel decrements if the deleted node was the only one at the top level.

### 5. Ordered iteration: toArray() and the level-0 lane

The simplest and most useful property of a skip list is that iteration over the level-0 chain visits every key in ascending sorted order in O(n) time — no sorting required because insert maintains the invariant. toArray() is therefore a linear walk from head.forward[0] to tail, collecting keys. The catch is duplicates: if your insert ignores a key already present, toArray() never returns duplicates; if insert allows them, the array might have repeated entries. Either contract is fine, but it must be consistent and tested. The senior concern is that the sorted invariant cannot be broken by any sequence of inserts and deletes — verify this with an adversarial sequence: insert out of order, delete some keys, insert again, and assert toArray() is still strictly ascending. This is also the right time to benchmark: with a coinFlip that promotes aggressively (many levels), how does the node-visit count of has() compare to a linear scan over the array for n = 1000 keys? Even a rough counter — increment a visit counter in the traversal loop — demonstrates the O(log n) property experimentally.

**Definition of done:**

- toArray() returns keys in strictly ascending order for any insertion sequence, including out-of-order and mixed with deletes — verified by an adversarial test that inserts 10 keys in reverse order, deletes 3, then checks the array is sorted.
- A node-visit counter in the traversal shows has() visits O(log n) nodes on a tall list (promoted coinFlip) versus O(n) for a linear scan over the same data — the ratio is visible at n ≥ 100.

**Self-review:** Insert [5, 1, 9, 3, 7] in that order and show the full level-0 chain after each insert; a senior reviewer checks the chain is sorted after every step, not just at the end, proving insert maintains the invariant incrementally.

### 6. Complexity proof, parameter tuning, and adversarial inputs

The O(log n) claim is probabilistic, not worst-case — nail down exactly what that means and under what conditions it breaks. The standard proof shows that the expected number of node comparisons during a search is at most (log_{1/p} n)/p + 1/p for promotion probability p (typically p = 0.5 giving O(log_2 n)). The practical lesson is that p is tunable: p = 0.25 gives shorter expected height (log_4 n ≈ 0.5 log_2 n) but wider towers per level, trading search cost for memory; p = 0.5 is the classic balance. The adversarial input is a deterministic coinFlip that always returns the same level — all nodes at level 1, degenerate to a linked list at O(n) per operation. A more realistic risk is insufficient entropy in a production RNG seeded with a low-resolution clock, which can produce correlated levels. The senior deliverable is a written analysis: given n = 10^6 keys and p = 0.5 and maxLevel = 20, what is the expected number of nodes at level 20? (about n/2^20 ≈ 1). What is the expected search cost? (about 1.33 × log_2(10^6) ≈ 27 comparisons). What does the search cost become if you accidentally use p = 1.0? (O(n), all nodes at maxLevel, list degenerates). These numbers make the parameter choices concrete instead of handwavy.

**Definition of done:**

- You can state the expected search cost formula for given n and p, compute it for n = 10^6 and p = 0.5, and name the condition under which the skip list degenerates to O(n) per operation.
- A benchmark with n = 1000 keys and a promoting coinFlip (p = 0.5) shows has() visits fewer than 2 × log2(1000) ≈ 20 nodes on average, while a linear scan always visits n/2 = 500 — the counter is instrumented in the test, not just asserted about.

**Self-review:** Given a coinFlip that always returns false (every node at level 1), what is the search cost for the largest key in a 1000-element list, and how does a senior engineer document this degenerate case in the API contract to warn callers?

## Rubric

### Level structure and probabilistic balance

- **Junior:** Nodes have forward pointers but level assignment uses Math.random() directly, making tests non-deterministic; maxLevel is not enforced, risking unbounded level generation.
- **Mid:** coinFlip is injected and maxLevel is enforced; sentinels bracket every level; the level-generation loop produces a geometric distribution of heights, verifiable with a controlled flip sequence.
- **Senior:** You can derive the expected node count at each level as n × p^k, state the search cost formula for arbitrary p, compute it for n = 10^6 and p = 0.5, and name the degenerate case (coinFlip always true or always false) and its cost.

### Search, insert, and delete correctness

- **Junior:** Insert appends to level 0 only; has() does a linear scan; delete uses a second full scan rather than the update-vector path; the sorted invariant is maintained accidentally rather than by design.
- **Mid:** All three operations use the update-vector traversal; has() descends from the top level; delete returns false for absent keys without mutating the structure; duplicate inserts do not corrupt size or order.
- **Senior:** An adversarial sequence (reverse-order inserts, interleaved deletes, re-inserts) never produces an incorrect toArray(); currentLevel decrements on delete when the top level empties; a visit counter proves O(log n) traversal on a tall list.

### Ordering and O(log n) traversal

- **Junior:** toArray() sorts the output after collecting nodes rather than relying on the structural sorted invariant; the O(n log n) sort cost hides that the invariant may not hold.
- **Mid:** toArray() is a plain level-0 walk — O(n), no sort — and the output is ascending for any insertion order; the level-0 completeness invariant is maintained by every insert and delete.
- **Senior:** A benchmarked has() with a visit counter shows sub-linear traversal (< 2 × log2 n nodes) versus O(n) for a linear scan on the same data at n ≥ 1000; the coinFlip-tuning analysis quantifies the p = 0.25 vs p = 0.5 memory-vs-speed trade-off with numbers.

## Senior stretch

- Implement a rank() operation — given key k, return how many keys in the list are less than k — in O(log n) by augmenting each forward pointer with a span (number of level-0 nodes it skips over); update spans on every insert and delete.
- Build a persistent skip list using path-copying: insert and delete return a new root-header without modifying the old structure, so every version is reachable by its head pointer — useful for snapshot reads and MVCC-style concurrency.
- Replace the in-memory node graph with a paged layout where each node's forward pointers are stored in a flat typed array (e.g. Int32Array) to improve cache locality and measure the throughput difference for n = 100,000 keys.
- Implement a finger search variant: cache the last lookup position as a 'finger' and start subsequent searches from the finger rather than from head, reducing cost to O(log d) where d is the key-distance from the finger — useful for sequential or near-sequential access patterns.
- Analyse and demonstrate when a skip list outperforms a B-tree for in-memory ordered maps: argue using cache-line access patterns, pointer-chasing cost versus page-fill factor, and range-scan throughput — support the argument with a benchmark at n = 10^5.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/skip-list
