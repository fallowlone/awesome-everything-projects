# A concurrent Go ingest service

Build a concurrent ingest/fan-out worker in Go — then operate it: bound the work, apply backpressure, make downstream calls survive failure, ship it in a minimal container, and work a goroutine-leak incident before it eats your memory.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** Go, net/http, context, log/slog, net/http/pprof, a metrics client (Prometheus), a minimal container base (distroless or scratch), a container runtime · **Tracks:** go, backend, performance, observability, deployment

## Deliverable

A deployed Go service that accepts HTTP intake, fans work into a bounded worker pool with backpressure, calls downstreams with timeouts and retries, exposes structured logs + pprof + metrics, shuts down gracefully, runs in a minimal container, and ships with a written post-mortem of a goroutine-leak/deadlock incident.

## Why this project

This is the Go track's capstone: take everything from the concurrency, runtime, and production-patterns units and ship one small service end to end. An ingest/fan-out worker looks trivial — accept requests, do work, call downstreams — but concurrency is where Go services actually die: unbounded goroutines, blocked channels, leaked work on cancellation, retries that amplify an outage. You will frame the SLOs, build the intake and a bounded pool, make it shed load instead of falling over, add timeouts and retries that don't make things worse, instrument it with logs/pprof/metrics, drain it cleanly on shutdown, containerize it small, deploy it with health and lifecycle hooks, then reproduce and post-mortem a real goroutine leak.

## Skills

- concurrency design
- worker pools and backpressure
- context and cancellation
- timeouts and retries
- graceful shutdown
- structured logging
- pprof profiling
- containerizing Go
- goroutine-leak diagnosis
- post-mortems

## Milestones

### 1. Frame the service: load, SLOs, concurrency budget

Before any code, size the work. Decide the target intake rate (say 2,000 req/s), the per-request fan-out (each intake spawns N downstream calls), and the downstream's own capacity — that product is your concurrency budget, and it is finite. Write SLOs (e.g. p99 accept < 20 ms, end-to-end p99 < 500 ms, zero unbounded goroutine growth) and explicit non-goals. The central decision: a Go service that spawns one goroutine per unit of inbound work has no upper bound, so you commit now to a bounded pool sized to what downstreams can actually absorb, not to what clients can send.

**Definition of done:**

- You have numbers: target intake QPS, per-request fan-out, downstream capacity, and the pool size and queue depth they imply.
- You wrote 2–3 SLOs (including a bounded-goroutine invariant) and at least two explicit non-goals.

### 2. Build the HTTP intake and a bounded worker pool

Implement the intake handler and a fixed pool of workers fed by a buffered channel. The handler validates and enqueues; a fixed set of worker goroutines (size your concurrency budget, not GOMAXPROCS by accident) drains the channel and does the fan-out. Every goroutine takes a context, and the work item carries its deadline. The point is structure: one place that spawns workers, one channel they read, so the goroutine count is a constant you chose — not an emergent property of traffic.

**Definition of done:**

- Worker count is a fixed, configured constant; under sustained load the goroutine count (from pprof) stays flat, not climbing.
- Every worker and downstream call receives a context, and a per-item deadline flows from the request through the work item.

### 3. Apply backpressure: shed load instead of buffering forever

Decide what happens when the queue is full. The wrong answer is an unbounded channel that swallows everything until memory dies; the right answer is a bounded queue plus a semaphore, where a full queue means the intake handler returns 503 + Retry-After fast rather than blocking. Make the bound explicit and the shedding observable. Backpressure is the difference between a service that degrades gracefully under overload and one that builds a multi-second latency tail and then OOMs — buffering is not a capacity strategy, it just hides the moment you ran out.

**Definition of done:**

- When the queue is saturated, intake returns 503 + Retry-After within your accept SLO instead of blocking or growing memory.
- A load test past pool capacity shows flat memory and a rising shed (503) rate, not an exploding latency tail.

### 4. Make downstream calls survive: timeouts, retries, cancellation

Wrap each downstream call so one slow or failing dependency can't pin your whole pool. Give every call a per-attempt timeout derived from the item's deadline, retry only idempotent failures with capped exponential backoff + jitter, and stop retrying the moment the parent context is cancelled. The trap to avoid: naive retries amplify a partial outage into a full one — if your downstream is at 50% errors and every client retries 3×, you've tripled the load on the thing that's already failing. Use errgroup or a structured fan-out so a failed sibling cancels the rest and the deadline is a hard ceiling, not a suggestion.

**Definition of done:**

- Each downstream call has a per-attempt timeout and retries only idempotent failures with capped backoff + jitter, stopping on context cancel.
- A fault test (inject a hanging downstream) shows the call timing out and cancelling siblings, with no goroutines parked on the dead dependency.

### 5. Instrument it: structured logs, pprof, metrics

Make the running service legible from the outside. Emit structured logs (log/slog) with a request/trace id you can correlate across the fan-out, expose net/http/pprof on a private port for live goroutine, heap, and CPU profiles, and publish metrics: intake rate, shed (503) rate, queue depth, worker utilization, downstream error/latency, and — the one that catches the leak — live goroutine count. These are what make the incident milestone diagnosable instead of a guessing game; a flat goroutine line on a dashboard is your early warning that the leak you'll induce later is happening.

**Definition of done:**

- Logs are structured with a correlatable id across the fan-out, and /debug/pprof serves a live goroutine profile on a private port.
- A dashboard shows intake rate, shed rate, queue depth, downstream latency, and live goroutine count tied to your SLOs.

### 6. Drain on shutdown: finish in-flight work, lose nothing

Make termination deliberate. On SIGTERM, stop accepting new intake (server.Shutdown), then close the queue and let workers finish in-flight items within a drain deadline, cancelling anything that overruns. The failure to avoid is the lost-work shutdown: the process exits the instant the orchestrator sends SIGTERM, abandoning everything queued and in-flight. A correct drain is ordered — stop intake, signal workers, wait with a bounded timeout, force-cancel the stragglers — and it's what lets a rollout or scale-down be a non-event instead of a burst of dropped requests.

**Definition of done:**

- On SIGTERM the service stops intake, drains in-flight work within a bounded deadline, and exits 0 with no goroutines still running.
- A test that sends SIGTERM mid-load shows in-flight items completing (or cleanly cancelled), not silently dropped.

### 7. Containerize small and deploy with health + lifecycle

Ship it as a minimal, secure image and deploy it with the lifecycle hooks that make the previous milestone matter. Build a static binary, put it in a distroless or scratch base (single-digit MB, no shell, non-root, no embedded secrets), and wire deployment health: a liveness probe that catches a deadlocked process and a readiness probe that gates traffic until the pool is up. Make the orchestrator's terminationGracePeriod longer than your drain deadline, so SIGTERM → drain → exit completes before SIGKILL — otherwise your graceful shutdown is decorative.

**Definition of done:**

- The image is a non-root static binary on a minimal base (single-digit MB, no shell, no baked secrets), and a push builds and deploys it.
- Liveness and readiness probes are wired, and the grace period exceeds the drain deadline so shutdown completes before SIGKILL.

### 8. Survive a goroutine leak, then write the post-mortem

Induce a real leak: a downstream call where the goroutine sends on an unbuffered channel whose receiver gave up after a timeout, so each cancelled request strands one goroutine forever. Under load the live-goroutine line climbs, heap grows with it, GC works harder, and eventually the service OOMs or deadlocks. Detect it from your own goroutine metric, pull a pprof goroutine profile to find the thousands parked on the same channel send, fix it (give the sender a way out — select on ctx.Done(), or a buffered slot), and confirm the line goes flat. Then write the post-mortem: a longer GC interval or a bigger memory limit only buys time; the root cause is a goroutine with no exit on cancellation.

**Definition of done:**

- You reproduced the leak under load and captured the climbing goroutine count plus a pprof profile pinning the leak to one channel send.
- You fixed it with a cancellable send (select on ctx.Done() or a buffered slot) and showed the goroutine line returning flat.
- Your post-mortem names the trigger, the blast radius, the fix, and one prevention that is not 'raise GOMEMLIMIT' or 'restart on OOM'.

**Self-review:** Paste your post-mortem's root cause and the prevention item; a senior reviewer checks it names the leak mechanism (a send with no cancellation path), not just the symptom (rising memory / OOM).

## Rubric

### Concurrency structure and goroutine bound

- **Junior:** Work is dispatched with go func() per request; goroutine count grows with traffic and nothing bounds it.
- **Mid:** A fixed worker pool drains a buffered channel; goroutine count is a configured constant proven flat by pprof under load.
- **Senior:** Pool size is derived from the downstream's real capacity (not GOMAXPROCS); every goroutine owns a context, carries its item deadline, and has an explicit exit path on cancellation — the goroutine count on a dashboard holds flat under a fault injection that cancels half the in-flight items.

### Backpressure and context cancellation propagation

- **Junior:** The queue is unbounded or the handler blocks indefinitely; a full pool causes latency to climb without a visible limit.
- **Mid:** A full queue returns 503 + Retry-After fast; downstream calls carry a per-attempt timeout and stop retrying on context cancel.
- **Senior:** errgroup or structured fan-out propagates cancellation so a failed sibling immediately releases its siblings' slots; a hanging downstream fault test shows no goroutines parked past the deadline, and memory stays flat under a load that would previously OOM.

### Observability and graceful shutdown

- **Junior:** Logs are unstructured; the service exits immediately on SIGTERM, dropping queued and in-flight work.
- **Mid:** Structured logs carry a correlatable request id; pprof and RED metrics are exposed; SIGTERM drains in-flight work within a bounded deadline before exit.
- **Senior:** The goroutine count metric is wired to an SLO; the graceful drain is ordered (stop intake → signal workers → bounded wait → force cancel), and the terminationGracePeriod exceeds the drain deadline so SIGKILL is never the termination path in normal operation.

### Goroutine-leak diagnosis and post-mortem depth

- **Junior:** The post-mortem describes symptoms (memory rose, service restarted) without naming the mechanism.
- **Mid:** A pprof goroutine profile pins the leak to a specific channel send; the fix is applied and the goroutine count shown returning flat.
- **Senior:** The post-mortem names the root cause (send with no cancellation path on a channel whose receiver timed out), quantifies the blast radius (N goroutines stranded per cancelled request at P RPS over T minutes = M leaked goroutines), and names a prevention that is not 'raise GOMEMLIMIT' — for example, a select on ctx.Done() in every channel send.

## Senior stretch

- Add adaptive concurrency: size the worker pool from observed downstream latency (AIMD or a Little's-law target) instead of a fixed constant.
- Add a circuit breaker per downstream so a sustained failure trips open and sheds fast instead of retrying into a brownout.
- Tune the runtime under load: set GOMAXPROCS and GOMEMLIMIT for the container's CPU/memory limits and show the GC and tail-latency effect.
- Make intake durable: persist accepted work to a queue so an in-flight crash replays instead of silently dropping, without adding latency to the accept path.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/go-concurrent-service
