# Circuit breaker

Build a circuit breaker that stops hammering a failing dependency, probes it safely with a half-open state, and resets automatically — the exact pattern that keeps microservice cascades from turning one bad node into a full outage.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** backend, distributed

## Deliverable

A state-machine circuit breaker where repeated failures open the circuit, a time-based probe transitions to half-open, a successful probe resets to closed, and a failed probe re-opens with a fresh recovery timer — verified with a deterministic injected clock, no Date.now().

## Why this project

A circuit breaker is the distributed-systems equivalent of an electrical fuse: it stops propagating failures from one service to its callers when the failure rate crosses a threshold, then probes cautiously before re-admitting load. Building one from scratch makes you confront the core tensions — consecutive vs rate-based tripping, eager vs lazy state transition, optimistic vs conservative probe strategy — and the injected-clock discipline is what makes the whole thing unit-testable without sleeping in tests.

## Skills

- finite state machine
- fail-fast pattern
- half-open probe
- injected clock
- observability counters

## Milestones

### 1. Failure counter: track consecutive failures and trip to open

The circuit breaker's only job in the closed state is to count consecutive failures and trip the circuit when they exceed the threshold. The critical subtlety is 'consecutive': a success resets the counter to zero, so a single good call absorbs failures around it. The threshold (say, 5) is a tuning knob — too low and a transient blip opens the circuit unnecessarily; too high and a genuinely broken dependency gets N retries before you cut the flow. At this stage implement exactly that: a counter that increments on each failed call, resets on success, and transitions to 'open' when it hits the threshold. Do not short-circuit yet — that is the next milestone. Get the state machine skeleton right first: the states are 'closed', 'open', and 'half-open'; only 'closed' accepts calls in this milestone. Make the threshold and the open duration configurable, and inject the clock as a parameter on every call rather than capturing it at construction — this is what makes the whole system unit-testable without mocking Date.now().

**Definition of done:**

- Consecutive failures up to threshold keep state 'closed', and the failure at threshold transitions to 'open' — but open state does not yet short-circuit calls.
- A success anywhere in the sequence resets the failure counter, and the threshold and open duration are constructor options, not magic numbers.

**Self-review:** Walk the counter through: 2 failures, 1 success, 3 more failures on a threshold-3 breaker — show what state and counter value you hold after each call; a senior reviewer checks the success resets to zero and the third post-reset failure trips, not the total fifth failure.

### 2. Open state: short-circuit and never invoke the wrapped function

Once the circuit is open, every call must fail fast without touching the dependency — the whole point of the pattern is to stop amplifying load onto something that is already broken. The breaker throws immediately, and crucially it does not call the wrapped function at all: an open circuit is a promise that the dependency will get zero requests during the recovery window. This matters because every call to a struggling service adds latency, ties up a thread or connection, and potentially makes recovery slower. Measure the short-circuit by verifying the wrapped function's call count stays at zero while the breaker is open. The thrown error must be distinguishable from the wrapped function's own errors so callers can decide whether to degrade gracefully or propagate — a generic Error is not enough; a typed CircuitOpenError (or a flag on the error) gives the caller that choice. The recovery window (openMs) starts from the moment the circuit trips, not from the last call.

**Definition of done:**

- While open and before the recovery window expires (now < openedAt + openMs), call() throws without invoking the wrapped function — verified by a call counter that stays at zero.
- The error thrown while open is distinct from a wrapped-function error (a CircuitOpenError class or a typed discriminant), so callers can handle each case separately.

**Self-review:** Show a test where three failed calls trip the breaker, then ten more calls while open — a senior reviewer checks the call counter on the wrapped function is exactly 3 (the ones that tripped it), not 13, and that the thrown error is identifiable as a circuit-open condition, not a generic Error.

### 3. Half-open probe: allow one call through after the recovery window

The recovery window expires and you do not jump straight back to closed — you probe. A half-open circuit allows exactly one call to reach the dependency: if it succeeds, the breaker resets to closed; if it fails, it re-opens with the timer reset to now. The 'exactly one' constraint is load-critical: if you let through a burst of calls the moment the window expires, you risk re-breaking a service that is just starting to recover. halfOpenMax controls how many concurrent probes are allowed (usually 1). The state transition on the probe result must be atomic from the caller's perspective: a successful probe must clear the failure counter and set state to closed in the same logical step, not as two separate reads. Get the time comparison right: the transition from open to half-open is not event-driven (no timer fires) — it is checked lazily on the next call. state(now) returns 'half-open' when now >= openedAt + openMs, and the call path checks state(now) before deciding what to do.

**Definition of done:**

- state(now) returns 'half-open' once now >= openedAt + openMs, and call(fn, now) at that point invokes fn exactly once (the probe) rather than short-circuiting.
- A successful probe resets state to 'closed' with failure counter at zero; a failed probe returns to 'open' with the recovery timer set to the current now, not the original trip time.

**Self-review:** Show the state timeline: trip at now=0 with openMs=1000, then a failed probe at now=1000 — what is openedAt after the re-open? A senior reviewer checks openedAt is reset to 1000, meaning recovery window counts from the failed probe, not from the original trip.

### 4. State-machine completeness: all transitions, edge cases, re-entry

At this point you have three states and four transitions: closed→open (threshold crossed), open→half-open (window expired, lazy), half-open→closed (probe succeeds), half-open→open (probe fails). Audit the machine for re-entry bugs: what happens if two callers race through the half-open window simultaneously? The first probe call should own the transition; the second must not also probe — if halfOpenMax is 1, the second call while a probe is in flight should either short-circuit (treating in-flight as still-open) or queue, depending on your design. Make this choice explicit and tested. Also audit the reset path: after a probe succeeds and state is closed, the next N failures must trip the circuit again from scratch — confirm the failure counter was actually reset, not just masked. Draw the full state machine (as a comment in the code is fine) naming every transition and its guard, so a future maintainer does not have to reconstruct it from code.

**Definition of done:**

- All four state transitions are covered by tests, including the re-open-after-probe path and a re-trip after a successful probe reset.
- The state machine is documented as a comment or diagram naming each state, each transition, and its guard condition — not left implicit in the implementation.

**Self-review:** Describe what your breaker does if two goroutines/async calls both check state at now >= openedAt + openMs before either probe has resolved — a senior reviewer checks either only one probe reaches the dependency (halfOpenMax enforced) or the design trade-off is documented.

### 5. Rolling failure window: count failures in a time window, not consecutively

A consecutive-failure counter has a sharp edge: one success in the middle of a string of failures resets the counter to zero, so a dependency that is failing 80% of the time might never trip the breaker if the 20% successes are distributed. A rolling window counts failures and total calls in the last N seconds (a ring buffer or bucket wheel), trips on failure rate >= threshold%, and is much more representative of whether the dependency is actually healthy. The tradeoff is memory: a window of 60 seconds with 1 ms buckets is 60,000 counters per breaker instance; most implementations use 10–60 coarser buckets (each covering one second). Implement the rolling window as a replacement for the consecutive counter. Crucially, bucket expiry is time-based: a bucket from 61 seconds ago is expired and its failures do not count, but you must not rely on a background sweep — expire lazily when a new call arrives. Test the edge: failures that fall exactly on the bucket boundary (at window age == windowMs) should not count.

**Definition of done:**

- The breaker trips on failure rate (failures/total >= threshold%) within the rolling window, not on consecutive count, and a single success interspersed with failures does not reset the window.
- Bucket expiry is lazy (triggered on call, not by a background timer) and an expired bucket's failures are excluded — tested by advancing the injected clock past the window boundary.

**Self-review:** Show the ring-buffer layout for a 10-bucket, 10-second window: after the injected clock advances 15 seconds, which buckets are live, which are expired, and what happens to the counts in the now-expired buckets? A senior reviewer checks lazy expiry discards them on the next call, not in a background sweep.

### 6. Metrics and fallback: observe the breaker, handle open gracefully

A circuit breaker that trips silently is an outage with no signal. Emit counters for: total calls, failures, short-circuits (calls rejected while open), successful probes, failed probes, and state transitions. These are the numbers that tell you whether the breaker is tuned correctly — if short-circuit count is zero and failures spike, the threshold is too high; if short-circuit count is enormous and the dependency is healthy, the window is too long. Counters are cheap (increment-only), so emit them on every call path. For callers, the circuit-open error is an opportunity to degrade gracefully: return a cached result, a default value, or a 503 with Retry-After derived from openedAt + openMs - now. Design a Fallback interface that the breaker accepts optionally, called when the circuit is open. Test that the fallback fires when the circuit is open and does not fire when the circuit is closed — the breaker must not swallow the fallback result as a success and inadvertently reset the failure counter.

**Definition of done:**

- The breaker exposes a metrics snapshot (total, failures, shortCircuits, probesSucceeded, probesFailed, currentState) that increments correctly across all call paths.
- An optional fallback function is invoked when the circuit is open (not when closed), its return value surfaces to the caller, and it does not count as a probe success or reset the failure counter.

**Self-review:** Show the metrics snapshot after: 4 failures (threshold=3), 2 short-circuits, one successful probe — a senior reviewer checks shortCircuits=2, probesSucceeded=1, failures=4, and currentState='closed', and that the fallback result does not appear in the probesSucceeded counter.

## Rubric

### State machine correctness

- **Junior:** Three states exist in code but transitions have gaps: a success mid-sequence may not reset the counter, or the open→half-open check fires on a background timer instead of lazily on the next call.
- **Mid:** All four transitions are implemented and tested; open→half-open is lazy (checked on call, not scheduled); a failed probe resets the recovery timer to now, not to the original trip time; a successful probe resets the failure counter.
- **Senior:** The machine is documented (states, transitions, guards) as a comment or diagram; re-entry under concurrency (two callers racing the half-open window) is either blocked by halfOpenMax or the trade-off is stated; rolling-window expiry is lazy and tested at the boundary.

### Clock-driven recovery (half-open)

- **Junior:** Recovery uses setTimeout or Date.now() internally, making tests dependent on wall-clock time and unsuitable for deterministic CI.
- **Mid:** The clock is injected on every call (the `now` parameter), state(now) returns the correct state for any injected timestamp, and no Date.now() or timers appear in the implementation.
- **Senior:** The injected clock is the only source of time truth throughout; recovery-timer reset on failed probe (openedAt = now at probe time, not at original trip time) is proven by test; the suite runs in under 10 ms with no sleep calls.

### Failure accounting and observability

- **Junior:** Failures increment a counter and the counter trips the breaker; no metrics are exposed; callers cannot distinguish a circuit-open error from a wrapped-function error.
- **Mid:** A typed CircuitOpenError distinguishes short-circuit errors from wrapped-function errors; a metrics snapshot exposes total, failures, shortCircuits, probesSucceeded, probesFailed, and currentState.
- **Senior:** Metrics are correct across all call paths (verified by checking snapshot after a scripted sequence); rolling-window failure rate replaces the consecutive counter; an optional fallback fires on open and its result does not corrupt the probe counter.

## Senior stretch

- Implement a half-open bulkhead: allow halfOpenMax concurrent probes instead of exactly 1, track in-flight probes, and close the circuit only when all probes succeed — reason about what closing on the first success (optimistic) versus closing on all successes (conservative) means for a partially-recovered dependency.
- Add adaptive thresholds: the breaker tracks rolling p99 latency alongside the failure rate, and trips on sustained high latency even if requests succeed — because a dependency that responds in 30 s but returns 200 OK is not healthy from a customer perspective.
- Add coordinated multi-instance breaker state via a shared store (Redis or Postgres): a single breaker trip from one instance immediately propagates to all instances, so one bad canary protects the whole fleet — measure the propagation lag and state divergence window.
- Write a chaos test that wraps a real HTTP server: start it healthy, inject failures at 100% after N seconds, verify the breaker opens within threshold+1 requests, then heal the server and verify the breaker closes after a successful probe — all assertions wall-clock timed, no mocked dates.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/circuit-breaker
