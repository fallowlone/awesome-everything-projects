# Bloom Filter — starter

Implement `BloomFilter` in `src/bloom.ts` so the acceptance suite passes.

    bun test

Rules: hash functions are injected (deterministic, no crypto). The suite checks
no-false-negatives (50 adds, all found), false-positive behavior (fresh item
may be absent), a loose FP-fraction bound over 1000 absent keys, and that
fillRatio starts at 0 and grows after inserts. When tests are green, read the
project rubric and push to the senior bar (sizing math, variants, tradeoffs).
