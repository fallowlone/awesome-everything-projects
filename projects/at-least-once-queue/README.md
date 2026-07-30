# At-least-once queue — starter

Implement `Queue` in `src/queue.ts` so the acceptance suite passes.

    bun test

Rules: injected clock (no `Date.now()`), Bun stdlib only, no IO or DB.
The suite checks: lease exclusivity, re-delivery after visibility timeout,
ack permanence, two-job fan-out, idempotent `processOnce`, and dead-letter
routing after `maxAttempts`. When it is green, read the project rubric and
push to the senior bar: heartbeat lease renewal, exponential backoff with
jitter, and a chaos test that kills consumers mid-job.
