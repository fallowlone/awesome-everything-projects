import { test, expect, describe } from "bun:test";
import { BloomFilter } from "../src/bloom";

// ---------------------------------------------------------------------------
// Deterministic hash functions injected into every test.
// Based on FNV-1a 32-bit with three different offsets/seeds so outputs differ.
// These are intentionally simple — the suite only needs reproducible spread.
// ---------------------------------------------------------------------------

function fnv32a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // FNV prime 16777619; keep in 32-bit range
    h = Math.imul(h, 0x01000193);
  }
  return h | 0; // signed 32-bit — may be negative, that is intentional
}

// Three independent hash functions via different seeds
const h1 = (s: string): number => fnv32a(s, 0x811c9dc5);
const h2 = (s: string): number => fnv32a(s, 0x04c11db7);
const h3 = (s: string): number => fnv32a(s, 0xdeadbeef);

const HASHES = [h1, h2, h3]; // k = 3

// ---------------------------------------------------------------------------
// (a) No false negatives: every added item must be found
// ---------------------------------------------------------------------------

describe("no false negatives", () => {
  test("50 added items are all found by has()", () => {
    const bf = new BloomFilter(8192, HASHES); // ~1 KB, generous for 50 items
    const items: string[] = [];
    for (let i = 0; i < 50; i++) {
      const s = `item-${i}-abcxyz`;
      items.push(s);
      bf.add(s);
    }
    for (const s of items) {
      expect(bf.has(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) False positives are possible but a brand-new filter on a never-added
//     key should mostly return false (smoke check only — not a hard guarantee)
// ---------------------------------------------------------------------------

describe("false positive behavior", () => {
  test("empty filter returns false for an arbitrary key", () => {
    const bf = new BloomFilter(8192, HASHES);
    // A freshly constructed filter has all bits 0 — has() must be false
    expect(bf.has("never-added-key-xyz-987")).toBe(false);
  });

  test("a key whose bit positions are not all set returns false", () => {
    const bf = new BloomFilter(8192, HASHES);
    bf.add("only-this-item");
    // A completely different string almost certainly does not collide on all 3 bits
    // (collision probability ≈ (1/8192)^3 — negligible)
    expect(bf.has("totally-different-string-12345")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (c) FP fraction over 1000 absent keys stays below a loose bound
//
//     Parameters: m=8192 bits, k=3, n=200 items added.
//     Theoretical FP rate ≈ (1 − e^{−k·n/m})^k
//                         = (1 − e^{−3·200/8192})^3
//                         ≈ (1 − e^{−0.073})^3
//                         ≈ (0.0704)^3 ≈ 0.000349  (~0.035%)
//     We assert < 0.05 (5%) — a 140× safety margin — so any correct
//     implementation passes easily even with imperfect hash spread.
// ---------------------------------------------------------------------------

describe("false-positive fraction bound", () => {
  test("FP fraction on 1000 absent keys stays below 5% for m=8192, k=3, n=200", () => {
    const bf = new BloomFilter(8192, HASHES);

    // Add 200 items
    for (let i = 0; i < 200; i++) {
      bf.add(`present-item-${i}`);
    }

    // Probe 1000 keys that were never added
    let fps = 0;
    for (let i = 0; i < 1000; i++) {
      if (bf.has(`absent-key-${i}-zzzzzz`)) fps++;
    }

    const fpRate = fps / 1000;
    // Generous bound: well below any reasonable bloom filter should achieve here
    expect(fpRate).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// (d) fillRatio starts at 0, increases after inserts, stays ≤ 1
// ---------------------------------------------------------------------------

describe("fillRatio", () => {
  test("fresh filter has fillRatio 0", () => {
    const bf = new BloomFilter(8192, HASHES);
    expect(bf.fillRatio()).toBe(0);
  });

  test("fillRatio increases after inserts", () => {
    const bf = new BloomFilter(8192, HASHES);
    const before = bf.fillRatio();
    bf.add("some-item-alpha");
    bf.add("some-item-beta");
    bf.add("some-item-gamma");
    expect(bf.fillRatio()).toBeGreaterThan(before);
  });

  test("fillRatio never exceeds 1 even after many inserts", () => {
    const bf = new BloomFilter(256, HASHES); // tiny filter, easy to saturate
    for (let i = 0; i < 500; i++) bf.add(`flood-${i}`);
    expect(bf.fillRatio()).toBeLessThanOrEqual(1);
    expect(bf.fillRatio()).toBeGreaterThan(0);
  });
});
