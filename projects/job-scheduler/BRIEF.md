# Job scheduler

A cron + backoff job runner with at-least-once delivery, idempotent handlers, and visibility timeouts — so no job is silently lost even when workers crash mid-execution.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** node, postgres, hono · **Tracks:** backend, queues

## Deliverable

A scheduler where cron-triggered jobs run at-least-once, failed jobs retry with exponential backoff, and a chaos test killing workers mid-job produces zero lost and zero unsafe duplicate effects.

## Why this project

Building a job scheduler from scratch forces you to confront every distributed-systems pitfall in a contained context: what happens when a worker dies mid-job, how duplicate triggers arise from clock skew, why exponential backoff needs jitter, and how to prove idempotency. Postgres as the queue makes the entire state inspectable with a SELECT — no black-box broker required.

## Skills

- cron expression parsing
- visibility timeout + heartbeat
- exponential backoff with jitter
- idempotency keys
- dead-letter queue

## Milestones

### 1. Frame the queue: data model, due-time index, durable enqueue

Before any worker loop, model the queue as a Postgres table and decide what 'durable' means. Each job carries state (pending → claimed → done → failed → dead), a run_at timestamp, an attempt count, and a payload. The whole point of using Postgres-as-queue is that state is inspectable with a SELECT — no black-box broker — but it means the due-time scan is your hottest query, so it must ride a partial index on (run_at) WHERE state = 'pending', not a sequential scan over a growing table. Size it: at 500 jobs/s enqueue with a 7-day retention you carry ~300M rows, so the index — and a partitioning or archival plan — is not optional. Enqueue must be a single committed INSERT so a crash between accept and persist loses nothing.

**Definition of done:**

- Jobs survive a process restart (committed to Postgres, never in-memory), and you can show the lifecycle states a job can hold.
- The due-time scan uses a partial index (you confirmed with EXPLAIN it is an index scan, not a seq scan), and you stated the row-count and retention assumptions behind it.

**Self-review:** Show the EXPLAIN for the claim query as the table grows; a senior reviewer checks the due-time scan stays an index scan and that retention won't turn it into a seq scan in a month.

### 2. At-least-once: claim, visibility timeout, heartbeat

Make delivery survive a worker dying mid-job. A worker claims a due job by flipping it to 'claimed' with a lease that expires (the visibility timeout) — concurrent workers must not grab the same row, so the claim is an atomic UPDATE ... WHERE state='pending' ... RETURNING with FOR UPDATE SKIP LOCKED. If the worker crashes before finishing, the lease expires and the job becomes claimable again: that is at-least-once, and it is the only honest guarantee a durable queue can cheaply offer. Tune the timeout against your p99 job duration — too short and a slow-but-alive worker gets its job stolen and run twice; too long and a real crash leaves the job stuck for minutes. Long jobs extend the lease with a heartbeat (e.g. renew every 10s on a 30s visibility timeout) so liveness, not a fixed guess, drives reclaim.

**Definition of done:**

- Two workers racing for the same due job never both run it (proven with FOR UPDATE SKIP LOCKED or an equivalent atomic claim under concurrent load).
- A worker killed mid-job has its job reclaimed after the visibility timeout, and a long job holds its lease via heartbeat instead of being stolen.

**Self-review:** Under at-least-once, what happens if a worker finishes the work but is killed before marking the job done? A senior reviewer checks the answer is 'it reruns — that's why the next milestone exists', not 'it's lost'.

### 3. Retries: exponential backoff, jitter, dead-letter queue

A failed job must retry — but naive retries are a self-inflicted outage. Fixed-interval retries from thousands of jobs synchronize into a thundering herd that re-saturates the dependency that just failed; exponential backoff (e.g. 1s, 2s, 4s, 8s, capped at 5min) spreads them, and full jitter (sleep = random(0, backoff)) breaks the synchronization so retries don't all fire on the same tick. Cap the attempt budget: after N attempts (commonly 5–8) the job is poison and must move to a dead-letter queue rather than retry forever and clog the lane. The DLQ is a queryable table you alert on by depth — a rising DLQ depth is your earliest signal that a downstream is broken or a payload is malformed.

**Definition of done:**

- Retries use exponential backoff with full jitter and a capped delay, and you can show two failing jobs do not retry in lockstep.
- A job that fails N times lands in a dead-letter table (not retried forever), and DLQ depth is queryable for alerting.

**Self-review:** Show the backoff schedule and the jitter formula; a senior reviewer checks jitter is full (random(0, cap)) not fixed, and that the attempt cap routes to a DLQ instead of an infinite retry loop.

### 4. Cron and delayed jobs: schedule, clock skew, double-fire

Add recurring schedules and you import the hardest problem in the system: time. A cron entry (e.g. '*/5 * * * *') must materialize into concrete run_at rows, and the materializer itself runs on more than one node for availability — so two schedulers can compute the same fire time and enqueue the same minute twice. Clock skew between nodes makes 'is it due yet?' ambiguous near the boundary, and a daylight-saving jump or a leap second can skip or double a window. The fix is to make the fire deterministic and deduplicated: derive a per-occurrence key (schedule_id + the bucketed fire timestamp) and enqueue with a unique constraint so a double-compute collapses to one row. Decide your timezone and DST policy explicitly — 'run at 02:30 local' is a question, not an instant, on the night the clock springs forward.

**Definition of done:**

- A cron schedule materializes into run_at rows, and two scheduler instances computing the same fire time enqueue exactly one job (unique per-occurrence key, not best-effort).
- You documented the timezone/DST policy and can explain what your scheduler does on a spring-forward or fall-back boundary.

**Self-review:** Run two scheduler instances against one schedule with skewed clocks; a senior reviewer checks the per-occurrence dedup key collapses the double-fire to one row and that the DST policy is written down, not assumed.

### 5. Exactly-once effect: dedup store, transactional handlers

At-least-once delivery is settled; now make duplicate delivery harmless. You cannot get exactly-once delivery cheaply, but you can get exactly-once effect: every handler takes an idempotency key and records it in a dedup store inside the same transaction as its side-effect, so a replay is a no-op. The subtlety is the atomicity boundary — if the work and the dedup-key write are in separate commits, a crash between them either double-applies (key written after effect, but effect not idempotent) or replays forever (effect done, key not written). For effects outside Postgres (sending an email, calling a payment API) the dedup record and the local state must commit together and the external call must itself be keyed, or you fall back to the outbox pattern: commit intent locally, then deliver. Prove it: replaying any job twice produces exactly one side-effect.

**Definition of done:**

- Every handler is keyed by an idempotency key recorded in a dedup store in the same transaction as its effect, and replaying a job twice produces exactly one side-effect (proven by test).
- For a side-effect outside Postgres you can name the atomicity boundary (transactional dedup or outbox) and explain why a naive 'do work then mark done' double-applies on crash.

**Self-review:** Walk the crash window between doing the work and writing the dedup key; a senior reviewer checks the effect and the key commit atomically (or via outbox) so neither double-apply nor infinite-replay is possible.

### 6. Scale and survive: priority, fairness, observe, poison-pill incident

Run it under load and make it legible, then break it. Many workers polling one table contend on the same hot rows, so claims must use SKIP LOCKED and you must reason about poll interval versus latency (tight polling burns DB CPU; long polling adds delay). Add priority lanes — high-priority jobs jump the queue — but a pure priority column starves low-priority work, so promote by age (weighted fair queuing or oldest-eligible-within-budget) so nothing waits forever. Instrument RED on the worker loop: claim rate, failure rate, and job duration, plus queue depth and oldest-unclaimed-age as the SLO that actually matters. Then run the incident: a poison-pill job (a payload that crashes the handler every attempt) combined with a clock change that fires a thundering herd of due jobs at once — workers crash-loop on the poison job while the herd backs up the lane. Detect it from oldest-unclaimed-age and DLQ depth, mitigate live (route the poison to DLQ fast, fairness keeps the lane moving), then write the root cause.

**Definition of done:**

- Many workers scale claim throughput without double-claiming (SKIP LOCKED), and priority lanes promote by age so low-priority jobs are not starved under sustained high-priority load.
- A dashboard shows claim/failure rate, job duration, queue depth, and oldest-unclaimed-age tied to an SLO; a trace or structured log lets you localize a slow handler.
- You reproduced a poison-pill + thundering-herd incident, mitigated it live (fast DLQ routing + fairness), and wrote a post-mortem whose root cause names the mechanism (poison crash-loop / synchronized fire), not just 'queue backed up'.

**Self-review:** Paste the post-mortem root cause and the fairness/poison-routing fix; a senior reviewer checks oldest-unclaimed-age (not just throughput) is the SLO, that priority promotes by age, and that the poison-pill is named as the trigger — not just 'high latency'.

## Rubric

### Cron materialization and double-fire prevention

- **Junior:** A cron entry is polled in a loop and a job is enqueued when it fires; two scheduler instances running in parallel can both fire the same minute and enqueue the same job twice.
- **Mid:** Each cron occurrence gets a deterministic per-occurrence key (schedule_id + bucketed fire timestamp) and is enqueued with a unique constraint, so two schedulers computing the same fire time collapse to one row.
- **Senior:** The timezone/DST policy is written down — 'run at 02:30 local' is a documented question, not an implicit instant, on the night the clock springs forward. You can state what your scheduler does when a DST gap skips a scheduled minute (skip vs fire on the next available minute) and which postgres clock function is used and why it is stable across replicas.

### At-least-once delivery and visibility timeout

- **Junior:** A worker claims a job and marks it done after finishing; if the worker crashes mid-job the job is never retried — it is stuck in 'claimed' forever.
- **Mid:** Claim is an atomic UPDATE ... WHERE state='pending' ... RETURNING with FOR UPDATE SKIP LOCKED; a visibility timeout expires the lease and makes the job claimable again; long jobs renew the lease via heartbeat instead of being stolen.
- **Senior:** The visibility timeout is tuned against the p99 job duration — a value shorter than p99 causes a slow-but-alive worker to have its job stolen and run twice, creating a duplicate that the next milestone must make harmless. You can name the worst-case re-execution window (max_attempts × (visibility_timeout + max_backoff)) and justify the chosen timeout against that number.

### Backoff, jitter, and dead-letter routing

- **Junior:** Failed jobs retry at a fixed interval; many failing jobs fire at the same tick and create a thundering herd against the same broken dependency.
- **Mid:** Retries use exponential backoff with full jitter (sleep = random(0, cap)) and a max-attempts cap; a job that exhausts its attempts moves to a dead-letter table, not back to the pending lane.
- **Senior:** You can show that two jobs failing at the same instant do not retry in lockstep under the jitter formula (histogram or log-diff of next_run_at values). DLQ depth is queryable and wired to an alert so a rising DLQ is the earliest signal that a downstream is broken or a payload class is malformed — not discovered days later by a user report.

### Exactly-once effect and idempotent handlers

- **Junior:** Handlers run the side-effect and then mark the job done; a crash between the two steps either re-runs the effect or leaves the job stuck — no dedup mechanism exists.
- **Mid:** Each handler records an idempotency key in the same transaction as its side-effect, so a re-delivered job is a no-op. For effects outside Postgres, the dedup record and the local state commit atomically (or via outbox), so neither double-apply nor infinite-replay is possible.
- **Senior:** The chaos test — killing workers at random points — produces zero lost jobs and zero duplicate side-effects over a run of ≥ 1000 jobs with mixed types. You can walk the crash window for a non-Postgres effect (email send, payment call) and name the exact commit ordering that makes it safe: dedup-key-in-same-transaction vs outbox-publish-then-deliver, and when each is the right choice.

## Senior stretch

- Guarantee exactly-once effect across a non-Postgres side-effect (email/payment) via a transactional outbox: commit intent + dedup key locally, deliver from the outbox with the key, and prove a crash at any point neither double-applies nor drops the effect.
- Implement weighted fair queuing with age-based promotion so high-priority lanes jump the queue but low-priority jobs never starve — verify with a load test that the oldest low-priority job's wait stays bounded under sustained high-priority pressure.
- Add a rate-limited fan-out lane: a single trigger expands into thousands of child jobs delivered under a global token-bucket cap, so a fan-out can't thunder-herd a downstream — measure the downstream QPS stays under its limit.
- Shard the queue table by run_at (or hash) with an archival/partition-drop policy so the due-time scan stays an index scan at 300M+ rows and retention is a cheap partition drop, not a churning DELETE.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/job-scheduler
