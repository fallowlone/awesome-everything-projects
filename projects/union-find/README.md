# Union-Find (DSU) — starter

Implement `DSU` in `src/dsu.ts` so the acceptance suite passes.

    bun test

Rules: path compression in `find`, union by rank (or size) in `union`.
`count()` tracks disjoint sets; `connected(a,b)` delegates to `find`.
The suite checks initialisation, merge, transitivity, idempotent unions,
multi-component construction, and stability of the representative after
many unions and repeated `find` calls.
