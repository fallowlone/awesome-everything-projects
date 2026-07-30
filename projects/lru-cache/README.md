# LRU Cache — starter

Implement `LRUCache<K,V>(capacity)` in `src/cache.ts` so the suite passes.

    bun test

Contract: `get(k)` returns the value or `undefined`; `put(k,v)` inserts or updates;
`has(k)` checks existence; `size` is the live entry count. All must be O(1).
At capacity, `put` with a NEW key evicts the least-recently-used entry.
Both `get` and `put`-on-existing-key refresh recency. When green, check
the project rubric and push to the senior bar (TTL, hit-rate instrumentation).
