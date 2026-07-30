# Signals mini — starter

Implement `signal`, `computed`, `effect`, and `batch` in `src/signals.ts`.

    bun test

Rules: synchronous only, no deps, no I/O. Auto-track dependencies via a
current-execution-context stack. `computed` must be lazy and cached.
`batch` must coalesce writes so effects fire once. The diamond graph
`a→(b,c)→effect(b+c)` must evaluate the effect exactly once per update
to `a` (glitch-free). Dynamic deps: conditionally-read signals must
unsubscribe when the branch is not taken.
