import { test, expect } from "bun:test";
import { Queue } from "../src/queue";

const OPTS = { visibilityMs: 30_000, maxAttempts: 3 };

// (a) enqueue → claim returns the job; immediate second claim returns null (lease held)
test("claim leases a job and blocks a concurrent second claim", () => {
  const q = new Queue(OPTS);
  q.enqueue({ id: "j1", payload: "hello" });

  const first = q.claim(0);
  expect(first).not.toBeNull();
  expect(first!.id).toBe("j1");

  const second = q.claim(0); // same instant — job is still leased
  expect(second).toBeNull();
});

// (b) after the visibility window expires the job is re-delivered (at-least-once)
test("re-delivers an unacked job after visibility timeout", () => {
  const q = new Queue(OPTS);
  q.enqueue({ id: "j2" });

  expect(q.claim(0)).not.toBeNull();          // lease acquired at t=0
  expect(q.claim(0)).toBeNull();              // still leased

  // advance past the deadline
  const redelivered = q.claim(OPTS.visibilityMs + 1);
  expect(redelivered).not.toBeNull();
  expect(redelivered!.id).toBe("j2");
});

// (c) an acked job is never re-delivered
test("acked job is never re-delivered", () => {
  const q = new Queue(OPTS);
  q.enqueue({ id: "j3" });

  const job = q.claim(0);
  expect(job).not.toBeNull();
  q.ack(job!.id);

  // even well after the original lease window
  expect(q.claim(OPTS.visibilityMs + 1)).toBeNull();
});

// (d) two jobs → two concurrent claims hand out different jobs
test("two claims on two enqueued jobs return two different ids", () => {
  const q = new Queue(OPTS);
  q.enqueue({ id: "a" });
  q.enqueue({ id: "b" });

  const first = q.claim(0);
  const second = q.claim(0);

  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(first!.id).not.toBe(second!.id);
});

// (e) processOnce runs the effect exactly once per key
test("processOnce is idempotent — effect runs exactly once per key", () => {
  const q = new Queue(OPTS);
  let calls = 0;
  const eff = () => { calls++; };

  q.processOnce("k1", eff);
  q.processOnce("k1", eff);
  q.processOnce("k1", eff);

  expect(calls).toBe(1);
});

// (f) a job nacked > maxAttempts times lands in deadLetter and is no longer claimable
test("job exceeding maxAttempts moves to dead-letter and is not claimable", () => {
  const LOCAL_MAX = 2;
  const q = new Queue({ visibilityMs: 1, maxAttempts: LOCAL_MAX });
  q.enqueue({ id: "poison" });

  // nack maxAttempts + 1 times (each nack must happen after the lease expires)
  for (let i = 0; i <= LOCAL_MAX; i++) {
    const job = q.claim(i * 2); // t=0,2,4,6 — always past prior lease of 1ms
    if (job) q.nack(job.id);
  }

  expect(q.deadLetter.length).toBeGreaterThan(0);
  expect(q.deadLetter[0].id).toBe("poison");

  // no longer appears via claim
  expect(q.claim(999)).toBeNull();
});
