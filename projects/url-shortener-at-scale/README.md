# URL Shortener at Scale — starter

Implement `encodeBase62`, `decodeBase62`, and `Shortener` in `src/shortener.ts`
so the acceptance suite passes.

    bun test

Rules: counter-based unique codes (no `Math.random` / `Date.now`), inject
the clock via the `now` parameter. The suite checks base62 round-trips, create
+ resolve, unknown code, TTL expiry, redirect policy, and 100-code uniqueness.
When it is green, read the project page's rubric and push to the senior bar
(cache-stampede dampening, 301 permanence tradeoffs, hot-code coordination).
