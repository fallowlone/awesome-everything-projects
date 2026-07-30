# Feature-flag service

Build a small flag service with targeting rules, percentage rollouts, and a typed SDK that evaluates flags client-side from a cached ruleset.

**Difficulty:** intermediate · **Est. days:** 5 · **Stack:** node, hono, zod · **Tracks:** backend, apis

## Deliverable

An API that serves a flag ruleset and an SDK where flagOn('x', user) returns a deterministic, percentage-correct boolean.

## Why this project

Feature flags look trivial until you need deterministic rollouts and low-latency evaluation. You'll design the rule model, make percentage rollouts stable under change via consistent hashing, cache aggressively with ETags, and ship a typed SDK — the core of LaunchDarkly-style systems.

## Skills

- rule evaluation
- consistent hashing for rollouts
- caching + ETag
- typed SDK design

## Milestones

### 1. Cached, ETag'd ruleset

Model flags + rules and serve them over a cached, ETag'd endpoint.

**Definition of done:**

- GET returns the flag ruleset with an ETag; a matching If-None-Match returns 304 with no body.
- Flags and targeting rules are modelled with a typed, validated schema.

### 2. Deterministic % rollout

Implement deterministic percentage rollout via hashing user id + flag key.

**Definition of done:**

- hash(userId + flagKey) buckets a user so the same user always gets the same answer and ~X% are enabled at X.
- Changing the rollout percent moves the boundary monotonically without reshuffling already-enabled users.

## Rubric

### Deterministic rollout

- **Junior:** Percentage rollout uses Math.random() per request; the same user gets a different answer on consecutive calls and the enabled fraction is approximate at best.
- **Mid:** hash(userId + flagKey) mod 100 buckets a user deterministically: the same user always resolves to the same bucket, ~X% are enabled at X, and monotonic bucket expansion means increasing the rollout never disables already-enabled users.
- **Senior:** You reason about bucket collisions between flags: if you hash userId alone (not userId+flagKey), users in the 0–10% bucket are always the same people for every flag — a systematic bias that skews A/B results. Salting with flagKey breaks the correlation. You demonstrate this with a chi-squared distribution test on a simulated user population.

### Ruleset caching & propagation latency

- **Junior:** The SDK fetches the full ruleset from the API on every evaluation call; a high-traffic service adds a network round trip to every request.
- **Mid:** The ruleset is served with an ETag; SDK clients cache it locally and revalidate with If-None-Match, receiving 304 (no body transfer) when unchanged — evaluation is in-process with no per-call network I/O.
- **Senior:** You reason about kill-switch propagation latency: a cache TTL of 60s means a flag turned off for a security incident stays on for up to 60s in every SDK. Streaming (SSE push) eliminates that window but adds a persistent connection per SDK instance. You document the chosen tradeoff and the worst-case propagation delay under your polling interval.

### Eval consistency & targeting correctness

- **Junior:** Targeting rules are applied in arbitrary order; a user matching multiple rules gets a non-deterministic result depending on evaluation sequence.
- **Mid:** Rules are evaluated in priority order with an explicit fallthrough to the percentage rollout; the same rule model and same user always produce the same boolean, and the schema is typed and validated so a malformed rule is rejected at write time, not at eval time.
- **Senior:** You address the stale-ruleset window: an SDK client evaluating a cached ruleset while the server has already changed a rule produces a split-evaluation inconsistency — some users see the old behavior, some the new. You document when this is acceptable (gradual rollout) vs. when it is not (a security kill-switch needing propagation in seconds), and show how the streaming channel closes the gap.

## Senior stretch

- Add a streaming update channel (SSE) so SDKs refresh without polling.
- Prove rollout stability: a user never flickers between on/off as unrelated flags change.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/feature-flags-service
