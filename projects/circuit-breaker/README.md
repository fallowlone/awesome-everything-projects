# Circuit Breaker — starter

Implement `CircuitBreaker` in `src/breaker.ts` so the acceptance suite passes.

    bun test

Rules: inject the clock via the `now` arg on every call (no `Date.now()`).
The suite checks closed→open tripping, short-circuit (fn never called while open),
half-open probe at recovery boundary, successful probe → closed, and failed probe
→ open with timer reset. When it is green, read the project rubric and push to
the senior bar (rolling window, metrics, fallback).
