# Regex Engine — starter

Implement `compile` and `match` in `src/regex.ts` so the acceptance suite passes.

    bun test

Rules: use Thompson NFA construction (NOT recursive backtracking). `compile(pattern)`
returns an NFA; `match(nfa, input)` does full-string match via set-of-states simulation.
The suite checks literals, `.`, `*`, `+`, `?`, grouping, alternation, and — critically —
that `(a*)*b` on 30 'a's returns false without hanging (linear-time guarantee).
