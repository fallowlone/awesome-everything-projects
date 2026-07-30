# Text Diff (Myers) — starter

Implement `lcs` and `diff` in `src/diff.ts` so the acceptance suite passes.

    bun test

Rules: `lcs<T>(a,b)` returns the longest common subsequence. `diff<T>(a,b)`
returns an edit script `{op:'keep'|'insert'|'delete', value:T}[]` where
keep+insert ops in order reproduce `b`, and keep+delete ops reproduce `a`.
No external deps — bun stdlib only. When green, push to the Myers O(ND)
diagonal search and add `apply` + hunk grouping per the project rubric.
