# Cache Stampede Lab — starter

Implement `Cache` and `shouldEarlyRefresh` in `src/cache.ts` so the suite passes.

    bun test

Rules: inject `now` and `rand` — never call `Date.now()` or `Math.random()` in the
unit. Concurrent `get()` calls for the same cold key must share ONE loader invocation
(single-flight). Callers arriving while a refresh is in-flight receive the stale value
immediately. `shouldEarlyRefresh` implements the XFetch probabilistic formula.
When the suite is green, push to the senior bar: metrics, adaptive beta, cache eviction.
