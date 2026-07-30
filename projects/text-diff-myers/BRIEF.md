# Text diff — Myers algorithm

Implement the Myers diff algorithm from scratch: compute the longest common subsequence, backtrack an edit script, prove minimality, and apply patches so any round-trip is byte-perfect.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** typescript · **Tracks:** algorithms, engineering-practice

## Deliverable

A TypeScript library exposing `lcs<T>` and `diff<T>` where the diff output is a minimal edit script (keep / insert / delete ops), `apply` reconstructs the target exactly, and the Myers O(ND) diagonal search drives the core.

## Why this project

Implementing Myers diff from scratch exposes the full algorithm design arc: a classical DP solution that is correct but slow, an LCS-based edit script that proves the concept, and then the O(ND) diagonal search that makes it production-grade. Every `git diff`, every code review tool, every merge resolution engine runs this algorithm — understanding it at the V-array level means you can reason about why a diff is readable or not, tune context lines, and diagnose the off-by-one errors that haunt every naive implementation.

## Skills

- dynamic programming
- LCS and edit distance
- Myers O(ND) diff
- backtracking edit scripts
- hunk grouping and patch format
- round-trip fidelity

## Milestones

### 1. Longest common subsequence via dynamic programming

Before touching Myers, build your intuition on the classical O(MN) LCS DP table. Given two sequences A and B, the LCS is the longest sequence of elements that appear in order in both — not necessarily contiguous. The recurrence is simple: if A[i] == B[j] extend the LCS from [i-1][j-1]; otherwise take the best of [i-1][j] and [i][j-1]. The table encodes every alignment choice, and the backtrack through it yields the actual LCS elements, not just the length. Getting backtrack right is non-trivial: diagonal moves (match), left moves (skip B[j]), and up moves (skip A[i]) must reproduce the same LCS length from every cell. Implement this as a generic `lcs<T>(a: T[], b: T[]): T[]` and prove it for strings, numbers, and mixed-type arrays. The O(MN) table will later motivate Myers as the upgrade that finds the minimal diff without materialising the full table.

**Definition of done:**

- `lcs(a, b)` returns the correct LCS for at least three distinct test cases (identical arrays, one empty, and an interleaved change), verified with deep equality.
- You can explain why the backtrack must prefer diagonal moves to produce a consistent LCS when multiple backtrack paths yield the same length.

**Self-review:** Trace the DP table and backtrack for `(['a','b','c'], ['a','x','c'])` on a whiteboard; a senior reviewer checks the cell values are correct, the backtrack avoids duplicate choices, and the result is `['a','c']` — not `['a']` or `['c']`.

### 2. Backtrack the DP table into a minimal edit script

The LCS tells you what to keep; everything else is a delete (in A but not in the LCS) or an insert (in B but not in the LCS). Backtrack the DP table simultaneously through both sequences: a diagonal step emits a `keep`, a leftward step emits an `insert` from B, an upward step emits a `delete` from A. The resulting array of `{op, value}` objects is the edit script. Two invariants must hold: (1) reading `keep` + `insert` ops in order yields B exactly — these are the elements you keep from A and the new elements you add; (2) reading `keep` + `delete` ops in order yields A exactly — these are the elements kept and the elements removed. These invariants make the script applicable: you can reconstruct either side from the other without storing both. Get the ordering of ops right: they must follow the alignment of A and B, not be arbitrarily reordered. A common bug is emitting all deletes before all inserts for a changed region — a correct script interleaves them as the alignment dictates.

**Definition of done:**

- For the input `(['a','b','c'], ['a','x','c'])`, `diff` returns `[{op:'keep',value:'a'},{op:'delete',value:'b'},{op:'insert',value:'x'},{op:'keep',value:'c'}]` or an equivalent minimal script (same edit distance).
- Round-trip: applying keep+insert from the script yields B, applying keep+delete yields A — proven by test for at least three distinct cases.

**Self-review:** Show what `diff(['a','b','c','d'], ['a','c','d'])` produces; a senior reviewer checks the script has exactly one delete (for 'b'), two keeps ('c','d'), and that the round-trip invariant holds — reconstructing B from keep+insert gives `['a','c','d']`, not `['a','b','c','d']`.

### 3. Replace the DP core with Myers O(ND) diagonal search

The O(MN) DP table materialises every alignment; Myers's insight is that you only need to find the shortest edit script (minimum number of inserts and deletes, called D) and that the edit graph has structure you can exploit. A diagonal k = x − y in the edit graph advances both pointers when elements match (a snake), and you walk snakes greedily. You iterate over D = 0, 1, 2, … until you reach the bottom-right corner; at each D you only explore the reachable diagonals (k ∈ {−D, −D+2, …, D}) and store only the furthest-reaching x-coordinate on each diagonal in an array V. The outer loop runs in O(D) passes, each pass touches O(D) diagonals, and each diagonal extension is O(1) amortised (snakes move in O(N) total across all diagonals), giving O(ND) overall — which is O(N + D²) and often much better than O(MN) when the diff is small. Store the V arrays at each D so you can backtrack the path and recover the edit script. This is the algorithm that powers `git diff`, GNU diff, and every line-diff tool in production.

**Definition of done:**

- The `diff` function uses Myers diagonal search internally (O(ND) loop with the V array), not the O(MN) DP table — verifiable by code inspection.
- All prior tests still pass after the swap — the edit script is observably equivalent (same ops and round-trips) even though the internal algorithm changed.

**Self-review:** Walk the V array evolution for `diff(['a','b','c'], ['a','x','c'])` step by step at D=0, D=1, D=2; a senior reviewer checks you can name the snake extensions at each diagonal and show the stored V values before backtracking.

### 4. Prove minimality: edit distance equals |deletes| + |inserts|

A diff algorithm is only useful if its output is minimal — the shortest possible edit script. Myers guarantees minimality by construction (it finds the smallest D by definition), but you must verify it empirically: the number of non-keep ops in your script must equal the true edit distance between A and B. The edit distance (Levenshtein with insert/delete only, no substitution) is len(A) + len(B) − 2 × len(LCS), because every element not in the LCS must be either deleted from A or inserted from B. Compare your diff's op count to this formula on at least five diverse pairs. A correct implementation will always match. An incorrect one will over-count (producing redundant ops) or under-count (corrupting the round-trip). This milestone also forces you to handle the degenerate cases cleanly: identical arrays (D=0, all keeps), one empty array (D=len of the other, all inserts or all deletes), single-element arrays, and very long arrays where D ≪ N.

**Definition of done:**

- For every test pair, `diff(a,b).filter(op=>op.op!=='keep').length === a.length + b.length - 2 * lcs(a,b).length` — verified by an automated assertion, not just by visual inspection.
- Edge cases (identical, one empty, single-element) all produce zero-overhead scripts: identical arrays have zero non-keep ops, empty A produces only inserts, empty B produces only deletes.

**Self-review:** Given `diff(['a','b','c','d','e'], ['b','c','e','f'])`, count the non-keep ops in your script and verify it equals `5 + 4 - 2*lcs.length`; a senior reviewer checks the formula holds and you can name the LCS without running the code.

### 5. Apply patch: round-trip fidelity and error handling

An edit script is only as good as its applicability. Implement `apply<T>(base: T[], script: EditOp<T>[]): T[]` that reconstructs the target by consuming keep and insert ops (in order, with delete ops consumed but not emitted). The apply function must be strict: if the base element at a keep or delete position does not match the expected value in the op, throw — a misapplied patch is worse than no patch because it silently corrupts data. Verify the forward round-trip: `apply(a, diff(a, b))` deep-equals `b`. Then verify the inverse: `apply(b, invertScript(diff(a, b)))` deep-equals `a`, where `invertScript` swaps inserts and deletes. These two round-trips together prove the script is not just syntactically valid but semantically correct. Test with strings (character diffs), numbers, and objects compared by a custom equality function passed as a parameter — `lcs<T>` and `diff<T>` must accept an optional `eq: (x: T, y: T) => boolean` for non-primitive equality.

**Definition of done:**

- `apply(a, diff(a, b))` === b for all test pairs (forward round-trip), and `apply(b, invertScript(diff(a,b)))` === a for the same pairs (inverse round-trip).
- `apply` throws a descriptive error when the base element at a keep/delete position does not match the op's value — verified by a test that feeds a deliberately corrupted base.

**Self-review:** Show the `apply` implementation for the mismatch-throws path; a senior reviewer checks the error message identifies both the position and the expected vs actual value, and that `apply` never silently swallows a conflict.

### 6. Hunk grouping and context lines — unified diff output

A raw edit script is a flat list of ops. What humans (and patch tools) work with is hunks: contiguous groups of changed ops with a configurable number of context lines (unchanged keeps) on each side. A standard unified diff uses 3 context lines; patch and git accept the context size as a flag. Group the edit script into hunks: scan for runs of inserts/deletes separated by more than 2×context keeps; each such run plus its context lines becomes one hunk. The hunk header carries line numbers in both the original and the target (`@@ -M,N +P,Q @@` in unified diff notation), computed by counting ops emitted so far. Implement `toUnifiedDiff(a: string[], b: string[], context = 3): string` that produces valid unified diff text and `fromUnifiedDiff(patch: string): Hunk[]` that parses it back. The round-trip `fromUnifiedDiff(toUnifiedDiff(a, b)).apply(a)` must reproduce b exactly. This is the format that `git apply`, `patch(1)`, and code review tools consume — getting the line numbers wrong by one is the canonical off-by-one that trips up every diff implementation.

**Definition of done:**

- `toUnifiedDiff` produces hunk headers (`@@ -M,N +P,Q @@`) with correct line numbers for at least two test pairs with non-adjacent changes; verified against the output of `diff -u` on the same inputs.
- The round-trip `a → toUnifiedDiff → fromUnifiedDiff → apply → b` succeeds for all test pairs, and hunks with adjacent changes are merged rather than emitted as separate hunks within the context window.

**Self-review:** Given two arrays differing at positions 2 and 8 (out of 15), show what `toUnifiedDiff` with context=3 produces: how many hunks, what their `@@ -M,N +P,Q @@` headers are, and whether the middle unchanged lines (positions 5–7) are included in context or split the hunks; a senior reviewer checks the boundary arithmetic, not just the final string.

## Rubric

### LCS & edit-script correctness

- **Junior:** LCS is computed and has the right length for common test cases; the edit script is derived by comparing A and B against the LCS but may emit redundant ops or get ordering wrong when multiple LCS alignments are possible.
- **Mid:** Backtrack through the DP table (or Myers V arrays) yields a unique, ordered edit script where the round-trip invariants hold: keep+insert yields B, keep+delete yields A — verified for identical, empty, and interleaved-change cases.
- **Senior:** The implementation handles all degenerate cases (both empty, one empty, identical, single-element, very long with D≪N), the minimality invariant `non-keep ops == len(A)+len(B)-2*len(LCS)` holds for every test pair, and a custom equality function is accepted as a parameter so the algorithm works for non-primitive element types.

### Minimality of the diff

- **Junior:** The output script is generally shorter than a naive one but is not provably minimal — some pairs produce more non-keep ops than the edit distance formula predicts.
- **Mid:** Myers O(ND) diagonal search is used and the D counter matches the actual edit distance; the minimality assertion `non-keep ops == len(A)+len(B)-2*len(LCS)` passes for all test pairs.
- **Senior:** You can explain why Myers is minimal by construction (it finds the smallest D by iterating D from 0), contrast it with the DP table (which also yields a minimal script but at O(MN) cost), and demonstrate empirically that no shorter edit script exists for the chosen test pairs.

### Apply / round-trip fidelity

- **Junior:** Applying the script forward reconstructs B for simple cases but breaks on edge cases (empty arrays, identical arrays, or arrays where D > N/2) — the error mode is silent wrong output, not a thrown exception.
- **Mid:** Both forward (`apply(a, diff(a,b)) === b`) and inverse (`apply(b, invertScript(diff(a,b))) === a`) round-trips pass for all test pairs, and `apply` throws a descriptive error on base-mismatch rather than silently corrupting the output.
- **Senior:** The unified diff output (`toUnifiedDiff`) produces correct `@@ -M,N +P,Q @@` headers with exact line numbers for all test pairs (verified against `diff -u`), and the parse→apply round-trip works for patches with multiple non-adjacent hunks and configurable context sizes.

### Algorithm clarity and complexity reasoning

- **Junior:** The implementation works but the O(ND) complexity claim is not justified — you cannot explain why D iterations of the diagonal search suffice, or what the V array represents.
- **Mid:** You can walk the V array step by step for a small example, explain why only even or odd diagonals are reachable at each D, and articulate why snake extensions are O(1) amortised.
- **Senior:** You can derive the O(N + D²) bound from first principles, demonstrate the crossover point where O(ND) outperforms O(MN) (roughly when D < √N), and explain Hirschberg's linear-space extension without implementing it — knowing the shape of the optimisation is the depth bar.

## Senior stretch

- Implement the linear-space Myers refinement (Hirschberg divide-and-conquer) that reduces peak memory from O(ND) to O(N): split the edit graph at the midpoint, recurse on each half, and reconstruct the full edit script without ever materialising the full V history.
- Add a semantic token-aware diff mode: instead of character arrays, diff a TypeScript AST token stream so that renaming a variable produces a single multi-site edit script rather than unrelated per-line diffs — measure how much smaller the edit distance is on a real refactor.
- Implement patience diff: instead of Myers on raw tokens, first find unique common lines as fixed anchors (patience sort), diff between anchors, and show empirically on real source-code files that patience produces more readable hunks than naive Myers when functions are reordered.
- Extend `apply` to a three-way merge: given a common ancestor O, and two diverged versions A and B, produce a merged result resolving non-conflicting hunks automatically and marking conflict regions for manual resolution — implement the conflict marker format that `git merge` uses.
- Benchmark Myers vs DP vs a WASM port of libxdiff on random 10k-line files and structured refactors; report the crossover point where O(ND) stops winning over O(MN) and explain it in terms of D/N ratio.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/text-diff-myers
