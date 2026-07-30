import { test, expect } from "bun:test";
import { TokenBucket } from "../src/bucket";

test("starts full and lets a burst through up to capacity", () => {
  const b = new TokenBucket(5, 1, 0);
  for (let i = 0; i < 5; i++) expect(b.tryRemove(0)).toBe(true);
  expect(b.tryRemove(0)).toBe(false); // 6th in the same instant is denied
});

test("refills at refillPerSec and never exceeds capacity", () => {
  const b = new TokenBucket(2, 1, 0);
  expect(b.tryRemove(0)).toBe(true);
  expect(b.tryRemove(0)).toBe(true);
  expect(b.tryRemove(0)).toBe(false);
  expect(b.tryRemove(1)).toBe(true);        // 1s later → 1 token back
  expect(b.tryRemove(1)).toBe(false);        // only one refilled
  b.tryRemove(101);                          // 100s idle must not overflow the cap
  expect(b.tokens).toBeLessThanOrEqual(2);
});

test("fractional refill accrues across calls (no rounding loss)", () => {
  const b = new TokenBucket(10, 2, 0);       // 2 tokens/sec
  b.tryRemove(0, 10);                         // drain to 0
  expect(b.tryRemove(0)).toBe(false);
  expect(b.tryRemove(0.4)).toBe(false);       // 0.8 token < 1
  expect(b.tryRemove(0.5)).toBe(true);        // 1.0 token at t=0.5
});
