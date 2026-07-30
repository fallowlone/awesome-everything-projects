import { test, expect } from "bun:test";
import { encodeBase62, decodeBase62, Shortener } from "../src/shortener";

// 1. Base62 round-trips
test("base62 round-trips for representative values", () => {
  for (const n of [0, 61, 62, 238327]) {
    expect(decodeBase62(encodeBase62(n))).toBe(n);
  }
});

// 2. Charset / length sanity
test("encodeBase62(0) is non-empty and encode(61) !== encode(62)", () => {
  expect(encodeBase62(0).length).toBeGreaterThan(0);
  expect(encodeBase62(61)).not.toBe(encodeBase62(62));
});

// 3. create then resolve returns the stored URL with default 301
test("create then resolve returns the stored url and redirect 301", () => {
  const s = new Shortener();
  const { code } = s.create("https://x.com", 0);
  const result = s.resolve(code, 0);
  expect(result).toEqual({ url: "https://x.com", redirect: 301 });
});

// 4. Unknown code resolves to null
test("resolve unknown code returns null", () => {
  const s = new Shortener();
  expect(s.resolve("zzzz", 0)).toBeNull();
});

// 5. TTL expiry
test("resolve returns non-null within ttl and null after expiry", () => {
  const s = new Shortener({ ttlMs: 1000 });
  const { code } = s.create("u", 0);
  expect(s.resolve(code, 500)).not.toBeNull();
  expect(s.resolve(code, 2000)).toBeNull();
});

// 6. Custom redirect policy propagates through create and resolve
test("redirect:302 is reflected in create result and resolve result", () => {
  const s = new Shortener({ redirect: 302 });
  const { code, redirect: createRedirect } = s.create("u", 0);
  expect(createRedirect).toBe(302);
  const resolved = s.resolve(code, 0);
  expect(resolved?.redirect).toBe(302);
});

// 7. Uniqueness: 100 creates yield 100 distinct codes
test("100 creates produce 100 distinct codes", () => {
  const s = new Shortener();
  const codes = Array.from({ length: 100 }, (_, i) =>
    s.create(`https://example.com/${i}`, 0).code
  );
  const unique = new Set(codes);
  expect(unique.size).toBe(100);
});
