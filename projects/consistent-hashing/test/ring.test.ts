import { test, expect } from "bun:test";
import { HashRing } from "../src/ring";

// ---------------------------------------------------------------------------
// Deterministic MurmurHash3-inspired 32-bit hash injected into all tests.
// Uses a fixed seed; no crypto dependency — results are reproducible everywhere.
// ---------------------------------------------------------------------------
function murmur3(s: string): number {
  let h = 0x12345678; // fixed seed
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  // finalizer avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// Fixed key population used across multiple tests
const KEYS: string[] = Array.from({ length: 200 }, (_, i) => `key-${i}`);

// ---------------------------------------------------------------------------
// (a) Basic contract: getNode returns one of the present node ids
// ---------------------------------------------------------------------------
test("getNode returns a node that is currently in the ring", () => {
  const ring = new HashRing({ vnodes: 10, hash: murmur3 });
  ring.addNode("node-A");
  ring.addNode("node-B");
  ring.addNode("node-C");

  const nodes = new Set(["node-A", "node-B", "node-C"]);
  for (const key of KEYS) {
    const node = ring.getNode(key);
    expect(nodes.has(node)).toBe(true);
  }
});

test("getNode with a single node assigns all keys to it", () => {
  const ring = new HashRing({ vnodes: 1, hash: murmur3 });
  ring.addNode("only-node");
  for (const key of KEYS) {
    expect(ring.getNode(key)).toBe("only-node");
  }
});

// ---------------------------------------------------------------------------
// (b) MINIMAL REMAP: after addNode, the fraction of keys that moved is tight
//     AND every key that moved now routes to the newly-added node.
//     This is the property that distinguishes consistent hashing from any
//     scheme that merely happens to move fewer than half the keys.
// ---------------------------------------------------------------------------
test("addNode remaps well below half the keyspace (minimal remap)", () => {
  const ring = new HashRing({ vnodes: 50, hash: murmur3 });
  ring.addNode("node-A");
  ring.addNode("node-B");
  ring.addNode("node-C");

  // Snapshot before
  const before = new Map<string, string>();
  for (const key of KEYS) before.set(key, ring.getNode(key));

  ring.addNode("node-D");

  // Count how many keys changed assignment and where they went
  let changed = 0;
  let movedToNewNode = 0;
  for (const key of KEYS) {
    const after = ring.getNode(key);
    if (after !== before.get(key)) {
      changed++;
      if (after === "node-D") movedToNewNode++;
    }
  }

  const fraction = changed / KEYS.length;
  // With 4 nodes after addNode, expected remap ≈ 1/4 = 0.25.
  // Assert tighter than 0.4 — a bad scheme can still satisfy < 0.5.
  expect(fraction).toBeLessThan(0.4);

  // Strong consistent-hashing property: EVERY key that moved must have
  // landed on the newly-added node. No key should have moved between
  // two pre-existing nodes (node-A, node-B, node-C).
  expect(movedToNewNode).toBe(changed);
});

// ---------------------------------------------------------------------------
// (c) removeNode reassigns ONLY the removed node's keys
//     Every key NOT on the removed node keeps its node exactly.
// ---------------------------------------------------------------------------
test("removeNode does not disturb keys that were not on the removed node", () => {
  const ring = new HashRing({ vnodes: 50, hash: murmur3 });
  ring.addNode("node-A");
  ring.addNode("node-B");
  ring.addNode("node-C");

  // Snapshot before removal
  const before = new Map<string, string>();
  for (const key of KEYS) before.set(key, ring.getNode(key));

  ring.removeNode("node-C");

  for (const key of KEYS) {
    const priorNode = before.get(key)!;
    if (priorNode !== "node-C") {
      // Must not have moved — C's removal should not disturb other arcs
      expect(ring.getNode(key)).toBe(priorNode);
    }
  }
});

// ---------------------------------------------------------------------------
// (d) BALANCE: vnodes > 1 yields strictly lower stddev of per-node key counts
//     than vnodes = 1, proving virtual nodes improve load distribution.
// ---------------------------------------------------------------------------
function stddev(counts: number[]): number {
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance =
    counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  return Math.sqrt(variance);
}

test("vnodes = 150 produces lower load stddev than vnodes = 1, with CV < 0.3 absolute", () => {
  const nodeIds = ["node-A", "node-B", "node-C", "node-D", "node-E"];

  // vnodes = 1
  const ring1 = new HashRing({ vnodes: 1, hash: murmur3 });
  for (const id of nodeIds) ring1.addNode(id);

  const counts1 = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const key of KEYS) {
    const n = ring1.getNode(key);
    counts1.set(n, (counts1.get(n) ?? 0) + 1);
  }
  const sd1 = stddev([...counts1.values()]);

  // vnodes = 150
  const ring150 = new HashRing({ vnodes: 150, hash: murmur3 });
  for (const id of nodeIds) ring150.addNode(id);

  const counts150 = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const key of KEYS) {
    const n = ring150.getNode(key);
    counts150.set(n, (counts150.get(n) ?? 0) + 1);
  }
  const sd150 = stddev([...counts150.values()]);

  // Relative assertion: higher vnodes must yield strictly lower standard deviation
  expect(sd150).toBeLessThan(sd1);

  // Absolute assertion: at 150 vnodes the coefficient of variation must be
  // below 0.3 — a meaningful upper bound that a naive single-point-per-node
  // scheme cannot satisfy (CV is typically 0.5–1.0 at vnodes=1 for N=5).
  const mean150 = [...counts150.values()].reduce((a, b) => a + b, 0) / nodeIds.length;
  const cv150 = sd150 / mean150;
  expect(cv150).toBeLessThan(0.3);
});
