import { test, expect } from "bun:test";
import { JobQueue, backoffMs } from "../src/queue";

const q = () => new JobQueue();

test("a due job is claimable, a future job is not", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 100 });
  queue.enqueue({ id: "b", runAt: 500 });
  expect(queue.claimable({ now: 200 }).map((j) => j.id)).toEqual(["a"]);
});

test("claiming takes a lease and counts the attempt", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  const [job] = queue.claim({ now: 1000, leaseMs: 30_000 });
  expect(job.state).toBe("claimed");
  expect(job.leaseUntil).toBe(31_000);
  expect(job.attempts).toBe(1);
});

test("a claimed job is invisible to other workers until its lease expires", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  queue.claim({ now: 1000, leaseMs: 5000 });

  expect(queue.claimable({ now: 2000 })).toHaveLength(0); // lease still held
  expect(queue.claimable({ now: 6000 }).map((j) => j.id)).toEqual(["a"]); // lease expired
});

test("a worker dying mid-job loses nothing — the lease expiry redelivers", () => {
  // This is the whole point of a lease over an in_progress flag: nobody is left
  // alive to reset the flag, but time still passes.
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  queue.claim({ now: 0, leaseMs: 1000 }); // worker takes it, then vanishes
  const [again] = queue.claim({ now: 2000, leaseMs: 1000 });
  expect(again.id).toBe("a");
  expect(again.attempts).toBe(2); // second delivery of the same job
});

test("two workers polling the same instant do not both get the job", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  const first = queue.claim({ now: 0, leaseMs: 5000 });
  const second = queue.claim({ now: 0, leaseMs: 5000 });
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(0);
});

test("heartbeat extends the lease of a job still running", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  queue.claim({ now: 0, leaseMs: 1000 });
  expect(queue.heartbeat("a", 900, 1000)).toBe(true);
  expect(queue.claimable({ now: 1500 })).toHaveLength(0); // not redelivered
  expect(queue.heartbeat("missing", 900, 1000)).toBe(false);
});

test("a completed job never comes back", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  queue.claim({ now: 0, leaseMs: 10 });
  queue.complete("a");
  expect(queue.claimable({ now: 10_000 })).toHaveLength(0);
  expect(queue.get("a")?.state).toBe("done");
});

test("a failure below the attempt limit retries later, not immediately", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  queue.claim({ now: 0, leaseMs: 100 });
  const job = queue.fail("a", { now: 1000, error: "boom", maxAttempts: 3, backoffMs: 5000 });
  expect(job?.state).toBe("pending");
  expect(job?.runAt).toBe(6000);
  expect(queue.claimable({ now: 2000 })).toHaveLength(0); // still backing off
  expect(queue.claimable({ now: 6000 })).toHaveLength(1);
});

test("a poison pill is dead-lettered instead of retried forever", () => {
  const queue = q();
  queue.enqueue({ id: "a", runAt: 0 });
  for (let i = 0; i < 3; i++) {
    queue.claim({ now: i * 10_000, leaseMs: 100 });
    queue.fail("a", { now: i * 10_000, error: "always", maxAttempts: 3, backoffMs: 1 });
  }
  expect(queue.get("a")?.state).toBe("failed");
  expect(queue.claimable({ now: 10_000_000 })).toHaveLength(0); // out of the queue
  expect(queue.get("a")?.lastError).toBe("always");
});

test("backoff doubles, caps, and stays deterministic without jitter", () => {
  expect(backoffMs(1, { baseMs: 1000, capMs: 60_000 })).toBe(1000);
  expect(backoffMs(2, { baseMs: 1000, capMs: 60_000 })).toBe(2000);
  expect(backoffMs(3, { baseMs: 1000, capMs: 60_000 })).toBe(4000);
  expect(backoffMs(10, { baseMs: 1000, capMs: 60_000 })).toBe(60_000); // capped
});

test("jitter keeps the delay inside the exponential window", () => {
  // Full jitter: a uniform draw in [0, exponential). Fixed intervals would let
  // thousands of simultaneous failures retry in lockstep and re-fail together.
  for (const r of [0, 0.5, 0.999]) {
    const d = backoffMs(3, { baseMs: 1000, capMs: 60_000, rand: () => r });
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(4000);
  }
  expect(backoffMs(3, { baseMs: 1000, capMs: 60_000, rand: () => 0 })).toBe(0);
});

test("a duplicate delivery applies the effect exactly once", () => {
  const queue = q();
  let charges = 0;
  const charge = () => { charges++; };
  expect(queue.applyEffectOnce("invoice-42", charge)).toBe(true);
  expect(queue.applyEffectOnce("invoice-42", charge)).toBe(false); // redelivery
  expect(charges).toBe(1);
  queue.applyEffectOnce("invoice-43", charge);
  expect(charges).toBe(2); // a different effect still runs
});
