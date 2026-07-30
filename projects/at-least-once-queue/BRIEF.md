# At-least-once job queue

Build a durable job queue on Postgres with visibility timeouts and idempotent consumers, so a crashed worker never drops a job.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** — · **Tracks:** queues, distributed

## Deliverable

A queue where every enqueued job runs at least once even across worker crashes, with duplicates made safe by idempotent handlers.

## Why this project

Most queuing tutorials hand you a managed broker and skip the hard part: what actually happens when a worker crashes mid-job. This project strips that away and forces you to build the safety net from first principles — an atomic claim that can't be double-grabbed, a visibility timeout that resurrects jobs from dead workers, and an idempotent consumer that turns unavoidable re-delivery into a no-op. The gap between at-least-once delivery (what any durable queue can promise) and exactly-once effect (what your business logic actually needs) is bridged entirely by the consumer side, and understanding that boundary is the difference between a queue that works under load and one that silently corrupts state on every retry.

## Skills

- SELECT ... FOR UPDATE SKIP LOCKED
- visibility timeout
- idempotency keys
- dead-letter handling

## Milestones

### 1. Claim jobs without double-grab

Claim jobs with FOR UPDATE SKIP LOCKED so two workers never grab the same row.

**Definition of done:**

- Two concurrent workers running the claim query never receive the same job row; a skipped-locked row is picked up by the other worker.
- The claim marks the row in-flight in the same transaction that selects it.

### 2. Re-queue jobs from dead workers

Add a visibility timeout that re-queues a job whose worker died before acking.

**Definition of done:**

- A job whose worker dies before ack becomes claimable again after the visibility timeout, not lost.
- A still-running worker extends its lease before the timeout so its job is not stolen mid-flight.

### 3. Make re-delivery a no-op

Make a consumer idempotent via an idempotency key so a re-delivered job is a no-op.

**Definition of done:**

- Processing the same job twice (same idempotency key) produces exactly one effect; the second run is a no-op.
- A poison job that always fails lands in a dead-letter store after N attempts instead of looping forever.

## Rubric

### Claim atomicity

- **Junior:** A worker selects a pending job and updates it in two separate statements; under concurrent load, two workers occasionally grab the same row.
- **Mid:** Claim is a single UPDATE ... WHERE state='pending' RETURNING with FOR UPDATE SKIP LOCKED — concurrent workers never double-grab, and a skipped row is immediately available to the next poller.
- **Senior:** You can reason about the contention model: SKIP LOCKED scales to many workers with no lock-wait latency, but concentrates all pending work on the oldest rows; you measure the claim throughput ceiling and know when to partition the queue table.

### Visibility timeout & re-delivery

- **Junior:** A crashed worker's job is stuck in 'claimed' until manually intervened; there is no automatic re-queue.
- **Mid:** A sweeper or lease check re-queues jobs whose visibility timeout expired; a live worker extends its lease via heartbeat so long jobs are not stolen.
- **Senior:** You set the timeout against p99 job duration and can articulate the two failure modes: too short means a slow-but-alive worker races its own task; too long means a real crash leaves the lane stalled for minutes — you document the chosen value and its rationale.

### Idempotent consumer & dead-letter

- **Junior:** Re-delivered jobs are processed again, occasionally producing duplicate side effects; no attempt cap exists.
- **Mid:** A dedup key recorded in the same transaction as the effect makes re-delivery a no-op; after N failures the job moves to a dead-letter table instead of looping.
- **Senior:** You reason about the atomicity boundary: if the effect and dedup key are in separate commits, a crash between them either double-applies or replays forever — your design makes both impossible, and you prove it with a chaos test killing workers at every crash point.

## Senior stretch

- Add exponential backoff with jitter and a dead-letter queue after N failures.
- Run a chaos test killing workers mid-job; assert zero lost and zero unsafe duplicate effects.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/at-least-once-queue
