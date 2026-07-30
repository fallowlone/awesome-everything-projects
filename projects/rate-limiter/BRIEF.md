# Distributed rate limiter

Build a token-bucket limiter that holds across many app instances by keeping the counter in Redis, not in process memory.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** — · **Tracks:** apis, backend

## Deliverable

Middleware that enforces N requests/window per key, returns 429 with Retry-After, and stays correct under concurrent load.

## Why this project

A distributed rate limiter is the smallest project that forces every hard distributed-systems lesson at once: why an in-process counter lies the moment you run two instances, why a read-modify-write split across the network is a race, and why the only honest fix is to make the whole bucket update atomic. The token-bucket math stays pure and unit-testable in one process; Redis then turns it into a concurrency problem you must serialize with a Lua script; and the 429/Retry-After protocol plus the fail-open-vs-fail-closed call turn it from an algorithm into a product decision with real abuse and availability trade-offs.

## Skills

- token bucket
- Redis atomics
- Lua scripting
- HTTP 429 + Retry-After

## Milestones

### 1. In-memory token bucket

Start where the algorithm is pure: one process, no network, all the subtlety in the refill math. A token bucket holds up to `burst` tokens and refills at `rate` tokens/sec; each request costs one token, and a request is allowed only if the bucket is non-empty. The trick is that you do not run a background refill timer — you compute the refill lazily on each request from `elapsed = now - lastRefill`, then clamp to `burst`. This lets a client sit idle, accumulate a full burst, and spend it in one spike (say 100 req in a 100-burst bucket refilling at 10/s) — which is exactly the bursty-but-bounded behaviour you want, and exactly why naive fixed-window counters feel wrong. Get the math and the clamping right here, single-threaded, before any of it has to survive a 0.5–2 ms Redis round trip or two instances racing.

**Definition of done:**

- Refill rate and burst size are configurable, and refill is computed lazily from elapsed time, not from a background timer.
- A unit test proves a full burst is admitted, the next request over capacity is throttled, and tokens come back at exactly `rate` after a measured idle gap.

**Self-review:** Walk through the refill computation for a client that was idle for 30 s on a 10/s-refill, 100-burst bucket: a senior reviewer checks you clamp to `burst` (not unbounded accumulation) and that `lastRefill` advances correctly on a denied request too.

### 2. Move the counter into Redis

The moment you run two app instances behind a load balancer, in-process state lies: each instance enforces its own bucket, so N instances let through N× the limit. The counter has to live in one shared place, and Redis is the usual choice because a single-threaded server gives you a serialization point and sub-millisecond ops. But a read-modify-write split across the network (GET, compute, SET) is a race: between your GET and SET another instance can decrement, and two requests double-spend the last token. This milestone is about getting the bucket state (tokens, lastRefill) into Redis and proving the concurrency hazard exists before you fix it properly in Lua — measure the over-admission under a concurrent hammer so the next milestone has a baseline to beat.

**Definition of done:**

- Bucket state (tokens + lastRefill timestamp) lives in Redis keyed per client, with a TTL so idle keys are reclaimed rather than leaking memory.
- A concurrency test with M instances hammering one key demonstrates the naive GET/compute/SET path over-admits (lets through more than the limit), and the over-count is recorded as the baseline to fix.

**Self-review:** Show your read-modify-write sequence and name the exact interleaving where two instances both observe one remaining token and both admit; a senior reviewer checks you understand why a multi-command transaction (or WATCH/MULTI) still isn't enough without atomic compute.

### 3. Make it atomic with a Lua script

Fix the race by collapsing read-modify-write into one atomic unit. A Redis Lua script (via EVAL/EVALSHA) runs to completion without interleaving because Redis is single-threaded — so the whole bucket update (read tokens+lastRefill, refill from elapsed, clamp to burst, decrement if allowed, write back) becomes one indivisible step, and the multi-node double-spend simply cannot happen. Two design rules matter at senior depth: (1) pass `now` into the script as an argument rather than calling `redis.call('TIME')`, so the script is deterministic and replication/AOF-safe across nodes with clock skew; (2) keep the script tiny and O(1) — it holds the single thread, so a slow script stalls every other client. Re-run the concurrency hammer from the previous milestone and watch over-admission go to zero.

**Definition of done:**

- The entire refill-and-decrement is one Lua script invoked via EVALSHA, and `now` is passed as an argument so the script is deterministic and replication-safe.
- Re-running the M-instance concurrency hammer on one key now never exceeds the configured limit (over-admission is zero against the milestone-2 baseline).

**Self-review:** Explain why calling `redis.call('TIME')` inside the script would be wrong under replication, and why a long-running Lua script is a self-inflicted latency incident on a single-threaded server; a senior reviewer checks the script is O(1) and time is injected, not read.

### 4. Sliding window vs fixed window vs bucket

Now justify the algorithm, because the choice has real failure modes. A fixed-window counter (increment a key that expires at the window boundary) is the cheapest — one INCR — but allows a 2× burst across the boundary: a client can fire `limit` requests in the last second of window A and `limit` more in the first second of window B, doubling the intended rate for one instant. A sliding-window log fixes that exactly by storing per-request timestamps, but its memory cost scales with the request rate (a sorted set of N entries per key). A sliding-window counter approximates it cheaply by weighting the previous window. Implement at least one alternative alongside your token bucket and load-test all of them under bursty traffic so you can state, with numbers, the accuracy-vs-memory trade-off rather than asserting it.

**Definition of done:**

- At least two algorithms (token bucket + one window variant) are implemented behind the same interface and selectable by config.
- A load test reproduces the fixed-window boundary burst (≈2× limit) and shows your sliding/bucket variant bounds it, with the per-key memory cost of each recorded.

**Self-review:** Given a 100 req/min limit, demonstrate the boundary attack on fixed-window numerically (200 requests in 2 seconds straddling the boundary), then show which of your variants prevents it and what it costs in Redis memory per active key.

### 5. 429, Retry-After, headers, and abuse handling

A limiter that just drops requests is a bad citizen; a well-behaved one tells the client exactly how to back off. Return 429 Too Many Requests with a `Retry-After` (seconds until a token is available, computed from the bucket's deficit and refill rate) and the standard `RateLimit-Limit / -Remaining / -Reset` headers so clients can self-throttle before they get blocked. Then harden the policy: choose the rate-limit key deliberately (API key beats raw IP, because NAT/CDN puts thousands of users behind one IP and a single spoofable header is forgeable), and decide what happens when Redis itself is down. Fail-open keeps the site up but hands an attacker a trivial bypass (knock out Redis, limiter disappears); fail-closed protects the backend but turns a Redis blip into a full outage. The senior answer is usually a bounded local fallback, not a binary.

**Definition of done:**

- Throttled responses return 429 with a correct `Retry-After` plus `RateLimit-Limit/-Remaining/-Reset`, and the limit key is something harder to forge than a raw IP.
- A Redis-outage test degrades to a documented policy (bounded local fallback or explicit fail-open/closed), and you can state how an attacker could weaponize that choice.

**Self-review:** If your fallback on Redis failure is fail-open, show how an attacker takes down Redis to disable the limiter and flood the backend; if fail-closed, show how a 2-second Redis blip becomes a customer-facing outage — a senior reviewer wants you to defend the chosen trade-off, not avoid it.

### 6. Load-test, observe, and work an incident

Prove it under real load and make it legible when it misbehaves. Load-test the limiter as deployed (multiple instances, real Redis, mixed allowed/throttled traffic) and find the QPS at which the Redis round trip — not your app — becomes the bottleneck: at ~0.5–2 ms per EVALSHA, a synchronous limiter check caps each instance's throughput, and a slow or hot Redis adds that latency to every single request. Emit RED metrics (request rate, throttle/error rate, limiter-check duration) and a trace span for the Redis call so you can see the limiter's own latency in the request waterfall. Then work the incident: a hot key (one abusive tenant, or every request keyed to the same value by a bug) concentrates load on one Redis slot, the limiter check's p99 spikes, and the limiter starts slowing the traffic it was meant to protect. Detect it from your own dashboard, mitigate, and find root cause.

**Definition of done:**

- A load test reports the QPS at which the Redis round trip caps throughput, and a dashboard shows limiter rate, throttle rate, and check-duration p50/p99.
- You reproduced a hot-key incident, localized it via the Redis trace span, mitigated it (key sharding, local short-TTL cache of the decision, or jittered checks), and wrote a short post-mortem naming a prevention that isn't 'add more Redis'.

**Self-review:** Paste your post-mortem's root cause and prevention; a senior reviewer checks you identified the limiter check as the hot path (not the app logic), that the trace span localized the Redis latency, and that the fix addresses key distribution — not just 'scale Redis up'.

## Rubric

### Correctness of refill

- **Junior:** Tokens drain on each request and the bucket starts full; a fixed delay tops them back up. It works in one process under light load.
- **Mid:** Refill is computed from elapsed time (not a timer), capped at capacity, and fractional tokens accrue across calls — burst and steady-state both behave.
- **Senior:** The same math holds under an injected clock with no rounding drift; you can state the bucket's worst-case burst and long-run rate and point at the test that pins each.

### Concurrency safety

- **Junior:** The counter lives in process memory and you acknowledge it does not hold across instances.
- **Mid:** The counter moves to a shared store; you identify the read-modify-write race and serialize it with a Lua script, an atomic op, or a transaction.
- **Senior:** Refill-then-remove is one atomic step under contention; you reason about clock skew between nodes and load-test that two instances enforce a single global ceiling.

### Abuse handling & observability

- **Junior:** Requests over the limit return HTTP 429.
- **Mid:** The 429 carries Retry-After and the limit key is the right identity — a per-API-key, not a per-IP that collapses everyone behind a proxy.
- **Senior:** You instrument the limiter as a hot path (RED metrics plus a trace span), reproduce a hot-key incident, and mitigate it with a post-mortem whose prevention is not 'add more Redis'.

## Senior stretch

- Add a sliding-window-log variant and compare its memory cost vs the bucket under bursty traffic.
- Make it fail-open vs fail-closed configurable, and load-test which one protects the backend better when Redis is down.
- Swap the token bucket for GCRA (the generic cell rate algorithm): store a single 'theoretical arrival time' instead of tokens+timestamp, and argue when its smoother, allocation-free shaping beats a classic bucket.
- Add per-tenant fairness so one noisy tenant can't starve others sharing a global ceiling — implement weighted or hierarchical limits and load-test the isolation.
- Push the limiter to the edge (CDN worker / API gateway) so abusive traffic is rejected before it reaches your origin, and reason about the consistency trade-off of per-edge-node vs globally-coordinated counters.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/rate-limiter
