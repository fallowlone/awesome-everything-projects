import { test, expect } from "bun:test";
import { CircuitBreaker } from "../src/breaker";

// Helper: a function that always throws.
const fail = () => { throw new Error("dependency error"); };
// Helper: a function that always succeeds.
const ok = () => "ok";

test("(a) stays 'closed' under repeated successes", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  for (let i = 0; i < 10; i++) {
    expect(cb.call(ok, i)).toBe("ok");
  }
  expect(cb.state(10)).toBe("closed");
});

test("(b) trips to 'open' after failureThreshold consecutive failing calls", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  for (let i = 0; i < 3; i++) {
    try { cb.call(fail, 0); } catch { /* expected */ }
  }
  expect(cb.state(0)).toBe("open");
});

test("(c) while open and before recovery window, call() short-circuits and does NOT invoke fn", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  // Trip the breaker at t=0
  for (let i = 0; i < 3; i++) {
    try { cb.call(fail, 0); } catch { /* expected */ }
  }
  // Now hammer it while open — fn must never be called
  let callCount = 0;
  const counted = () => { callCount++; return "counted"; };
  for (let t = 1; t < 500; t++) {
    try { cb.call(counted, t); } catch { /* short-circuit */ }
  }
  expect(callCount).toBe(0);
});

test("(d) at now >= openedAt + openMs, state is 'half-open' and probe call is permitted to run fn", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  // Trip at t=0
  for (let i = 0; i < 3; i++) {
    try { cb.call(fail, 0); } catch { /* expected */ }
  }
  // Exactly at recovery boundary
  expect(cb.state(1000)).toBe("half-open");
  // Probe should reach fn
  let probeReached = false;
  const probe = () => { probeReached = true; return "probe"; };
  cb.call(probe, 1000);
  expect(probeReached).toBe(true);
});

test("(e) a successful probe transitions the breaker to 'closed'", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  // Trip at t=0
  for (let i = 0; i < 3; i++) {
    try { cb.call(fail, 0); } catch { /* expected */ }
  }
  // Successful probe at recovery boundary
  cb.call(ok, 1000);
  expect(cb.state(1000)).toBe("closed");
});

test("(f) a failed probe returns to 'open' with recovery timer reset to now of the probe", () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, halfOpenMax: 1 });
  // Trip at t=0
  for (let i = 0; i < 3; i++) {
    try { cb.call(fail, 0); } catch { /* expected */ }
  }
  // Failed probe at t=1000 — recovery timer resets to t=1000
  try { cb.call(fail, 1000); } catch { /* expected */ }
  expect(cb.state(1000)).toBe("open");
  // Before new window expires: still open
  expect(cb.state(1999)).toBe("open");
  // At new window: half-open again
  expect(cb.state(2000)).toBe("half-open");
});
