# Rate Limiter — starter

Implement `TokenBucket` in `src/bucket.ts` so the acceptance suite passes.

    bun test

Rules: refill at `refillPerSec`, cap at `capacity`, start full, inject the clock
(no `Date.now()`). The suite checks burst, steady-state refill, the cap, and
fractional accrual. When it is green, read the project page's rubric and push to
the senior bar (distributed counter, atomic refill, abuse handling).
