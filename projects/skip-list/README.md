# Skip List — starter

Implement `SkipList` in `src/skiplist.ts` so the acceptance suite passes.

    bun test

Rules: inject `coinFlip` (never `Math.random()`), support `insert(k)`,
`has(k)`, `delete(k)`, `toArray()` ascending. The suite checks multi-level
promotion, sorted order, delete correctness, duplicate safety, and visit-count
sub-linearity on a tall list. When green, read the rubric and push to the
senior bar (rank(), persistent copy, cache-optimised layout).
