import { test, expect } from "bun:test";
import { LRUCache } from "../src/cache";

// (a) get/put round-trip
test("get returns the value put and undefined for absent keys", () => {
  const c = new LRUCache<string, number>(4);
  c.put("x", 42);
  expect(c.get("x")).toBe(42);
  expect(c.get("y")).toBeUndefined();
  expect(c.has("x")).toBe(true);
  expect(c.has("y")).toBe(false);
});

// (b) at capacity, putting a NEW key evicts the least-recently-used
test("putting a new key at capacity evicts the LRU entry", () => {
  const c = new LRUCache<string, number>(2);
  c.put("a", 1); // MRU: [a]
  c.put("b", 2); // MRU: [b, a]
  c.put("c", 3); // capacity=2 → evict a; MRU: [c, b]
  expect(c.get("a")).toBeUndefined(); // evicted
  expect(c.get("b")).toBe(2);
  expect(c.get("c")).toBe(3);
  expect(c.size).toBe(2);
});

// (c) get() counts as a use — a recently-get'd key survives over an untouched one
test("get refreshes recency so the read key outlives the untouched one", () => {
  const c = new LRUCache<string, number>(2);
  c.put("a", 1); // MRU: [a]
  c.put("b", 2); // MRU: [b, a]
  c.get("a");    // touch a → MRU: [a, b]
  c.put("c", 3); // capacity=2 → evict b (LRU); MRU: [c, a]
  expect(c.get("b")).toBeUndefined(); // b was evicted
  expect(c.get("a")).toBe(1);         // a survived
  expect(c.get("c")).toBe(3);
});

// (d) put on existing key updates value + refreshes recency WITHOUT increasing size
test("put on existing key updates value and recency but does not increase size", () => {
  const c = new LRUCache<string, number>(2);
  c.put("a", 1);
  c.put("b", 2);
  expect(c.size).toBe(2);
  c.put("a", 99); // update — should NOT evict b, size stays 2
  expect(c.size).toBe(2);
  expect(c.get("a")).toBe(99); // value updated
  expect(c.get("b")).toBe(2);  // b still present
});

// (e) exact eviction order over a defined operation sequence
test("eviction order is correct over a mixed get/put sequence", () => {
  const c = new LRUCache<string, number>(3);
  c.put("a", 1); // [a]
  c.put("b", 2); // [b, a]
  c.put("c", 3); // [c, b, a]
  c.get("a");    // promote a → [a, c, b]
  c.put("d", 4); // evict b (LRU) → [d, a, c]
  expect(c.get("b")).toBeUndefined(); // evicted
  expect(c.get("c")).toBe(3);
  expect(c.get("a")).toBe(1);
  expect(c.get("d")).toBe(4);
  expect(c.size).toBe(3);
});

// (f) capacity 1 edge case
test("capacity=1 evicts the previous entry on every new-key put", () => {
  const c = new LRUCache<number, string>(1);
  c.put(1, "one");
  expect(c.get(1)).toBe("one");
  c.put(2, "two"); // evicts 1
  expect(c.get(1)).toBeUndefined();
  expect(c.get(2)).toBe("two");
  expect(c.size).toBe(1);
  c.put(2, "TWO"); // update, no eviction
  expect(c.get(2)).toBe("TWO");
  expect(c.size).toBe(1);
});
