import { test, expect } from "bun:test";
import { build, codes, encode, decode } from "../src/huffman";

// ─── helpers ────────────────────────────────────────────────────────────────

function freqMap(s: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of s) m[c] = (m[c] ?? 0) + 1;
  return m;
}

// ─── (a) PREFIX-FREE: no code is a prefix of another ────────────────────────

test("(a) prefix-free — no code is a prefix of another (abracadabra)", () => {
  const tree = build(freqMap("abracadabra"));
  const table = codes(tree);
  const entries = Object.entries(table);
  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const [symA, codeA] = entries[i];
      const [symB, codeB] = entries[j];
      expect(
        codeA.startsWith(codeB),
        `code("${symA}")="${codeA}" is prefixed by code("${symB}")="${codeB}"`
      ).toBe(false);
    }
  }
});

test("(a) prefix-free — balanced distribution (abcdef)", () => {
  // each symbol appears once → all codes same length → only trivially prefix-free
  const tree = build(freqMap("abcdef"));
  const table = codes(tree);
  const entries = Object.entries(table);
  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const [symA, codeA] = entries[i];
      const [symB, codeB] = entries[j];
      expect(
        codeA.startsWith(codeB),
        `code("${symA}")="${codeA}" is prefixed by code("${symB}")="${codeB}"`
      ).toBe(false);
    }
  }
});

// ─── (b) FREQUENCY vs CODE-LENGTH ORDER ─────────────────────────────────────

test("(b) more-frequent symbol has code length ≤ rarer symbol (abracadabra)", () => {
  // a:5 b:2 r:2 c:1 d:1
  const s = "abracadabra";
  const tree = build(freqMap(s));
  const table = codes(tree);
  const fm = freqMap(s);
  const syms = Object.keys(fm);
  for (let i = 0; i < syms.length; i++) {
    for (let j = 0; j < syms.length; j++) {
      if (i === j) continue;
      const x = syms[i], y = syms[j];
      if (fm[x] > fm[y]) {
        expect(
          table[x].length <= table[y].length,
          `freq("${x}")=${fm[x]} > freq("${y}")=${fm[y]} but len(code("${x}"))=${table[x].length} > len(code("${y}"))=${table[y].length}`
        ).toBe(true);
      }
    }
  }
});

// ─── (c) ROUND-TRIP ─────────────────────────────────────────────────────────

test("(c) round-trip — decode(encode(s)) === s for a multi-symbol string", () => {
  const s = "abracadabra";
  const tree = build(freqMap(s));
  const table = codes(tree);
  const bits = encode(s, table);
  expect(decode(bits, tree)).toBe(s);
});

test("(c) round-trip — longer representative string", () => {
  const s = "the quick brown fox jumps over the lazy dog";
  const tree = build(freqMap(s));
  const table = codes(tree);
  expect(decode(encode(s, table), tree)).toBe(s);
});

// ─── (d) SINGLE-DISTINCT-SYMBOL edge case ───────────────────────────────────

test("(d) single-distinct-symbol 'aaaa' — round-trips and code is non-empty", () => {
  const s = "aaaa";
  const tree = build(freqMap(s));
  const table = codes(tree);
  // code must be a non-empty bit string
  expect(typeof table["a"]).toBe("string");
  expect(table["a"].length).toBeGreaterThan(0);
  // every char must be '0' or '1'
  expect(/^[01]+$/.test(table["a"])).toBe(true);
  // round-trip
  const bits = encode(s, table);
  expect(decode(bits, tree)).toBe(s);
});

// ─── (e) COMPRESSION: encoded length < fixed-width length ───────────────────

test("(e) compression — skewed distribution beats fixed-width encoding", () => {
  // alphabet size 4 → fixed-width = 2 bits/symbol
  // a:100 b:50 c:10 d:1 → 161 symbols → fixed = 322 bits
  // Huffman should be strictly shorter
  const freqs: Record<string, number> = { a: 100, b: 50, c: 10, d: 1 };
  const total = Object.values(freqs).reduce((s, v) => s + v, 0); // 161

  const tree = build(freqs);
  const table = codes(tree);

  // Build the full string from frequencies to encode it
  let s = "";
  for (const [sym, cnt] of Object.entries(freqs)) s += sym.repeat(cnt);

  const bits = encode(s, table);
  const alphabetSize = Object.keys(freqs).length; // 4
  const fixedWidth = Math.ceil(Math.log2(alphabetSize)); // ceil(log2(4)) = 2
  const fixedBits = fixedWidth * total; // 322

  expect(bits.length).toBeLessThan(fixedBits);
});

test("(e) compression — two-symbol alphabet is strictly better than 1 fixed bit each (skewed)", () => {
  // a:99 b:1 → fixed-width = 1 bit/symbol (ceil(log2(2))=1)
  // Huffman gives a=1 bit, b=1 bit too → same. But for 3+ alphabet we already test above.
  // More meaningful: a:90 b:9 c:1 → 3 symbols → fixed-width = ceil(log2(3)) = 2 bits
  const freqs: Record<string, number> = { a: 90, b: 9, c: 1 };
  const total = 100;
  const tree = build(freqs);
  const table = codes(tree);
  let s = "";
  for (const [sym, cnt] of Object.entries(freqs)) s += sym.repeat(cnt);
  const bits = encode(s, table);
  const fixedBits = Math.ceil(Math.log2(3)) * total; // 200
  expect(bits.length).toBeLessThan(fixedBits);
});
