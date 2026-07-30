# Async Python service, built and operated

Build an async FastAPI ingestion service that validates, pipelines, and survives load — then run it: package it, containerize it with correct PID-1 behaviour, and work the incident when a swallowed CancelledError quietly leaks tasks until the event loop starves.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** Python, FastAPI, Pydantic, uvicorn, asyncio, Docker, structlog or stdlib logging · **Tracks:** python, backend, performance, observability, deployment

## Deliverable

A running async API service with Pydantic-validated intake, a cancellation-correct async pipeline with per-stage timeouts, a pyproject-packaged build with a committed lockfile, a container with correct signal handling, structured logging plus externalized config, and a written post-mortem of an event-loop starvation incident.

## Why this project

This is the Python track's capstone: take async Python from a syntax feature to an operated service. An ingestion+API service looks simple — accept a payload, validate it, run a few async stages, return a result — but async is where Python's footguns live: a blocking call stalls the whole loop, a swallowed CancelledError leaks tasks, and a container that ignores SIGTERM drops in-flight work on every deploy. You will frame the SLOs, build the ASGI intake with Pydantic, make the pipeline cancellation-correct with real timeouts and selective shielding, package it with pyproject and a lockfile, containerize it so PID 1 forwards signals, instrument it with structured logs, then reproduce and post-mortem an event-loop starvation incident caused by a quietly swallowed cancellation.

## Skills

- async/await design
- Pydantic validation
- cancellation and timeouts
- structured concurrency
- packaging and lockfiles
- container signal handling
- structured logging and config
- incident response and post-mortems

## Milestones

### 1. Frame the service: load shape, SLOs, async non-goals

Before code, decide what this service is and is not. An async service earns its complexity only when work is I/O-bound and concurrent — fan-out to other services, DB calls, queue writes — not CPU-bound number-crunching that would just block the loop. Sketch the request flow (intake → validate → pipeline stages → respond), estimate concurrency (target RPS, per-request fan-out, expected in-flight task count), and write SLOs (e.g. p99 intake < 100 ms, accepted-payload durability) plus explicit non-goals so you do not reach for async where threads or a process pool belong.

**Definition of done:**

- You have numbers: target RPS, fan-out per request, and the resulting peak in-flight task estimate.
- You wrote 2–3 SLOs and at least two non-goals, including one piece of work you will deliberately keep off the event loop.

### 2. Build the ASGI intake with Pydantic validation

Stand up the FastAPI app and make the intake boundary strict. Every payload crosses one validation gate: a Pydantic model that coerces, bounds, and rejects — so malformed input fails at the edge with a 422, never deeper in the pipeline. Keep the request handler async and non-blocking; a single synchronous parse or hash over a large body silently serializes the whole loop. Define the request/response models so the contract is explicit and the failure shape is consistent.

**Definition of done:**

- Invalid payloads are rejected at the boundary with a 422 and a structured error body, validated by a test.
- The intake handler is async with no blocking call on the hot path, and you can point to where any CPU-heavy step would be offloaded.

### 3. Build the async pipeline with structured concurrency

Turn the validated request into a pipeline of concurrent async stages — enrich, fan out to dependencies, aggregate. Use structured concurrency (a task group / nursery) so child tasks are owned by a scope: if one fails, its siblings are cancelled and the failure propagates instead of leaking an orphaned task that runs to completion in the dark. This is the milestone where the difference between fire-and-forget and owned concurrency becomes the difference between a debuggable service and a haunted one.

**Definition of done:**

- Concurrent stages run inside a task group, and a forced failure in one stage cancels the siblings rather than leaving a running orphan.
- You can show, with a test or a task count, that no task outlives the request that spawned it.

### 4. Make it cancellation-correct: timeouts and shielding

Bound every external wait and handle cancellation honestly. Wrap dependency calls in per-stage timeouts so one slow upstream cannot pin a request — and a task — forever. Crucially, treat CancelledError as control flow, not an error: catch it only to clean up, then re-raise, never swallow it. Where a step must finish atomically (a committed write, a released lock), shield exactly that critical section and nothing more — over-shielding makes a service that ignores its own deadlines.

**Definition of done:**

- Each dependency call has a timeout, and a test proves a slow stage is cancelled at its deadline rather than hanging.
- Cancellation cleanup paths re-raise CancelledError, and exactly one critical section is shielded — you can justify why that one.

### 5. Package it: pyproject, entry points, lockfile

Make the service installable and reproducible, not a folder of scripts. Declare the project in pyproject.toml with pinned runtime dependencies and an entry point that launches the server, then resolve and commit a lockfile so every install — yours, CI's, the container's — gets the exact same dependency graph. Keep the import surface clean: a clear package layout means no sys.path hacks and no surprise from a stray top-level module shadowing a dependency.

**Definition of done:**

- A clean checkout installs from pyproject + lockfile and starts via the declared entry point, with no manual path fiddling.
- The lockfile is committed and pins transitive dependencies, so two installs a week apart resolve identically.

### 6. Containerize it: lean image, PID 1, signal handling

Put the service in a container that shuts down gracefully. The trap is PID 1: a Python process started as PID 1 does not get the kernel's default signal handlers, so a naive container ignores SIGTERM and the orchestrator hard-kills it after the grace period, dropping in-flight requests on every deploy. Fix it with a real init (tini / exec form) or explicit signal handling, then make the server drain — stop accepting, let in-flight pipelines finish or hit their deadline — before exit. Build a lean multi-stage image off the lockfile so the runtime layer carries only what it runs.

**Definition of done:**

- Sending SIGTERM to the container triggers a graceful drain (in-flight requests complete or time out), not an instant hard kill.
- The image is multi-stage and installs from the lockfile, with no build toolchain left in the runtime layer.

### 7. Make it legible: structured logging and config

Make the running service tell you what it is doing. Emit structured (JSON) logs with a request id threaded through every stage so one slow or failed request is a single query, not a grep across interleaved lines from concurrent tasks. Externalize config — log level, timeouts, dependency URLs, worker count — through environment, not constants, so the same image runs in dev and prod by changing inputs, not code. Log the events that matter for the incident ahead: task spawned, stage timed out, cancellation observed, drain started.

**Definition of done:**

- Logs are structured and carry a request id end to end, so you can reconstruct one request's full path from logs alone.
- Config comes from the environment with sane defaults, and the same image runs in two configs without a rebuild.

### 8. Survive event-loop starvation, then write the post-mortem

Under load, p99 intake latency climbs and never recovers, even though CPU looks idle. The root cause is a cancellation leak: one pipeline stage catches CancelledError and swallows it instead of re-raising, so timed-out tasks never actually die — they pile up, each holding a connection and a slot, until the event loop is so crowded with zombie tasks that ready coroutines wait their turn and everything starves. Reproduce it with a load test that forces timeouts, watch the in-flight task count climb without bound in your logs, then fix it by re-raising CancelledError and confirming the task count returns to baseline. Write the post-mortem: it must name the swallowed-cancellation mechanism, not just 'high latency'. Profile if you need to prove where the loop time went.

**Definition of done:**

- You reproduced the leak with a load test that forces timeouts, and captured the unbounded in-flight task count and the p99 climb in logs.
- You fixed it by re-raising CancelledError (no swallow), and showed the task count and p99 returning to baseline under the same load.
- Your post-mortem names the trigger, the swallowed-cancellation root cause, the blast radius, the fix, and one prevention that is not 'add more workers'.

**Self-review:** Paste your post-mortem's root cause and prevention item; a senior reviewer checks it names the swallowed-cancellation / leaked-task mechanism (re-raise CancelledError), not just the symptom (high latency, idle CPU).

## Rubric

### Pydantic validation boundary and blocking-the-loop hazard

- **Junior:** Payloads are validated manually with if/else or partially; a heavy parse or hash on the hot path runs synchronously and blocks the loop during its execution.
- **Mid:** A Pydantic model with a global ValidationPipe rejects malformed input at the edge with a structured 422; the intake handler is async with no blocking call on the hot path.
- **Senior:** The validation boundary is the single authoritative truth for request shape — no re-validation deeper in the pipeline. Any CPU-heavy step (large body hash, image decode) is explicitly offloaded to a thread pool via run_in_executor, and you can point at the one place this would go in the code.

### Cancellation correctness and structured concurrency

- **Junior:** Tasks are spawned with asyncio.create_task without ownership; a failed stage leaves sibling tasks running as orphans. CancelledError may be silently caught and not re-raised.
- **Mid:** Concurrent stages run inside a task group (TaskGroup or anyio nursery); a failed stage cancels its siblings. CancelledError is caught only for cleanup and always re-raised.
- **Senior:** Each dependency call has a per-stage timeout; exactly one critical section is shielded with asyncio.shield with a written justification; a load test that forces timeouts shows in-flight task count returning to baseline — not climbing without bound, which would indicate a swallowed cancellation.

### Backpressure, PID-1 signal handling, and graceful drain

- **Junior:** The container is started with python app.py as PID 1; SIGTERM is ignored and the orchestrator hard-kills the process after the grace period, dropping in-flight requests.
- **Mid:** PID-1 is fixed with tini or exec-form CMD; SIGTERM triggers a graceful drain — the server stops accepting new requests and waits for in-flight pipelines to finish or hit their deadline.
- **Senior:** In-flight task count is bounded by a semaphore so the loop degrades gracefully under overload (503 + Retry-After) instead of accumulating zombie tasks that starve ready coroutines. The drain deadline is shorter than the orchestrator's grace period so the process exits cleanly before SIGKILL.

### Event-loop starvation diagnosis and post-mortem depth

- **Junior:** The post-mortem describes high latency and idle CPU without naming why the loop was blocked.
- **Mid:** The post-mortem identifies the swallowed CancelledError as root cause; the fix (re-raise) is applied and the in-flight task count shown returning to baseline.
- **Senior:** The post-mortem quantifies the blast radius (N zombie tasks per forced timeout at P RPS over T minutes), names the prevention that is not 'add workers' — for example, a linting rule or a test that injects a CancelledError and asserts the task count drops — and explains why an idle-CPU symptom with rising p99 is the fingerprint of loop starvation, not a slow handler.

## Senior stretch

- Add backpressure: bound the in-flight task count with a semaphore or queue and shed load with a 503 + Retry-After instead of letting the loop degrade unboundedly.
- Move the one CPU-bound stage off the event loop into a process pool and measure the loop-latency improvement, proving you chose async only where it pays.
- Run the service multi-worker behind a process manager and reason explicitly about per-worker graceful drain on a rolling deploy.
- Add a synthetic chaos timeout that randomly cancels a fraction of stages in staging, so a future cancellation leak is caught by a test, not by an incident.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/python-async-service
