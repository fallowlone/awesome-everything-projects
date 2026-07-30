# URL shortener at scale

Build a URL shortener that survives real traffic — then run it: deploy it, watch it, and work the incident when one hot link melts your cache.

**Difficulty:** advanced · **Est. days:** 10 · **Stack:** Postgres, Redis, a reverse proxy or CDN, your backend language, a container runtime, an OpenTelemetry-compatible tracer · **Tracks:** system-design, apis, databases, backend, caching, security, engineering-practice, ci-cd, deployment, observability, performance

## Deliverable

A deployed redirect service with an indexed store, a read-through cache, a CI/CD pipeline, RED dashboards with SLOs, and a written post-mortem of a cache-stampede incident.

## Why this project

This is the capstone: take everything from the spine and ship one small system end to end. A URL shortener looks trivial — POST a long URL, GET a redirect — but the redirect path is read-heavy, latency-critical, and abused, so it forces real decisions about schema, caching, deploy, and on-call. You will design it, build the hot path, cache and protect it, test it under load, deploy it, instrument it, then survive and post-mortem a real incident.

## Skills

- API design
- schema and indexing
- caching strategy
- load testing
- CI/CD
- containers and k8s
- observability (RED/SLO)
- incident response
- post-mortems

## Milestones

### 1. Frame the system: scale, SLOs, non-goals

Before any code, size the problem. A shortener is overwhelmingly reads (redirects) over writes (creates) — often 100:1 or worse — so the redirect path is what your design must protect. Do the back-of-envelope math (target QPS, link count, storage, cache working set), then write down SLOs (e.g. p99 redirect < 50 ms, availability 99.9%) and explicit non-goals so you do not gold-plate the create path.

**Definition of done:**

- You have numbers: target redirect QPS, create QPS, total links, bytes per link, and the resulting storage and cache-memory estimates.
- You wrote 2–3 SLOs for the redirect path and at least two explicit non-goals.

### 2. Design the API, the schema, and the short code

Decide how short codes are generated and stored. A monotonic counter + base62 gives dense, collision-free codes but leaks volume and ordering; random/hashed codes hide that but need a uniqueness check and retry on collision. Pick one and justify it, then design the table and the single index the redirect lookup will ride, and choose where the cache and CDN sit.

**Definition of done:**

- Your API contract covers create and resolve, and you can state the collision behaviour of your code-generation choice.
- The schema has exactly the index the redirect query needs, and you justified it against the leading-column rule.

### 3. Build the redirect hot path

Implement create and resolve for real. The resolve path is the hot path: it must be a single indexed lookup returning a 301/302, with the request lifecycle (accept → route → handle → serialize) kept lean. Measure a cold (uncached) redirect end to end so you know the latency you are about to cache away.

**Definition of done:**

- A redirect resolves via one indexed query (you confirmed it with EXPLAIN, not a sequential scan).
- You recorded the cold redirect p50/p99 with no cache, as your baseline.

### 4. Cache the reads, protect the writes

Put a read-through cache in front of resolve and make create safe. The cache turns the hot path from a DB query into a memory hit, but introduces invalidation and a future stampede risk you will pay for later. On the write side, make create idempotent and rate-limit abusive creation so a script can't exhaust your code space or your database.

**Definition of done:**

- Cached redirects show a clear p99 drop versus the cold baseline, and you can explain your invalidation rule.
- Create is idempotent for the same input and rate-limited per client, with a 429 + Retry-After on abuse.

### 5. Test it: unit, integration, contract, load

Build the test pyramid for the service. Unit-test the code generation and refill/limit math, integration-test the resolve path against a real Postgres + cache, contract-test the API so clients don't break on a change, and load-test the redirect path to find where p99 degrades. The load test is what makes the next two milestones honest.

**Definition of done:**

- Unit, integration, and contract tests run green in one command, and a flaky test is quarantined, not retried-until-green.
- A load test reports the redirect QPS at which p99 crosses your SLO.

### 6. Deploy it: container, pipeline, rollout

Ship it through a pipeline, not by hand. Containerize with a lean image, wire a CI/CD pipeline that runs the tests as gates before build, roll out with a strategy that can fail safely (canary or blue-green), put redirects behind a CDN/load balancer, and keep secrets out of the image. A bad rollout should be reversible in seconds, not a redeploy.

**Definition of done:**

- A push runs tests → builds the image → deploys via the pipeline, and you can roll back without rebuilding.
- Secrets are injected at deploy, not baked into the image, and redirects are served behind a CDN or load balancer.

### 7. Observe it: RED, traces, SLOs

Make the running system legible. Emit RED metrics (rate, errors, duration) on the redirect path, structured logs you can actually query, and traces propagated across the cache and DB hops so a slow redirect points at the slow span. Turn your SLOs into dashboards and an error budget, so you find the incident before your users tweet it.

**Definition of done:**

- A dashboard shows redirect rate, error rate, and p50/p99 duration, tied to your SLOs and error budget.
- A trace for one slow redirect shows the cache and DB spans, so you can localize latency without guessing.

### 8. Survive a cache stampede, then write the post-mortem

A popular link's cache entry expires under peak traffic; thousands of concurrent misses hit Postgres at once, p99 redirect latency spikes, and the origin saturates. Detect it from your own metrics, mitigate it live, find the root cause, and write the post-mortem. The mechanism that saves you is request coalescing (single-flight) plus a probabilistic early refresh — not just a longer TTL, which only moves the cliff.

**Definition of done:**

- You reproduced the stampede with a load test (N concurrent misses on one hot key) and captured the p99 spike and origin QPS on your dashboard.
- You mitigated it with single-flight (one origin fetch per key) plus early-refresh jitter, and showed p99 returning to SLO.
- Your post-mortem names the trigger, the contributing factors, the blast radius, the fix, and one prevention that is not 'raise the TTL'.

**Self-review:** Paste your post-mortem's root cause and the prevention item; a senior reviewer checks it names the stampede mechanism (coalescing / early refresh), not just the symptom (high latency).

## Rubric

### Codec correctness

- **Junior:** Implements encodeBase62/decodeBase62 that round-trips for small values; may miss edge cases like n=0 or single-digit base62.
- **Mid:** Full round-trip for all non-negative integers including 0 and large values; correct charset order (no leading-zero ambiguity from using '0' as the first symbol).
- **Senior:** Can articulate why the charset order matters for URL safety, why base62 beats base64 for short codes in URLs, and what the max code length is for a given counter ceiling (e.g., 62^6 ≈ 56 billion links before 6-char codes overflow).

### Collision and expiry handling

- **Junior:** Counter increments per create; resolve returns null for unknown codes. TTL comparison may be off-by-one or use >= instead of >.
- **Mid:** Deterministic unique code generation with no collision by construction; TTL correctly distinguishes unknown (never existed) from expired (once existed); createdAt stored at create time, not resolve time.
- **Senior:** Reasons about the coordination cost of a shared counter in a distributed system (single point, requires atomic increment or a flake-ID strategy), the lookup-before-insert cost of random code generation, and when each approach's tradeoffs favour it (write-heavy vs. anonymity vs. predictability).

### Read-path scaling

- **Junior:** Understands that redirect is the hot path and that a cache helps; uses 301 by default without considering its implications.
- **Mid:** Explains that 301 is browser/CDN-cached permanently (fast but hard to revoke) while 302 is re-fetched every time (controllable but slower at scale); picks the right one for each use case and can justify it.
- **Senior:** Identifies the cache-stampede risk on hot codes (many concurrent misses on expiry), proposes single-flight (request coalescing) and probabilistic early refresh as mitigations — not just a longer TTL. Discusses CDN edge caching of 301s as a zero-backend-cost path and the blast-radius of a misconfigured permanent redirect.

## Senior stretch

- Go multi-region: serve redirects read-local and reason explicitly about the create-path consistency trade-off.
- Add a click-analytics pipeline (events → queue → rollups) that never adds latency to the redirect path.
- Support custom domains with automated TLS issuance and per-tenant isolation.
- Detect and throttle abusive create and redirect patterns without hurting legitimate traffic bursts.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/url-shortener-at-scale
