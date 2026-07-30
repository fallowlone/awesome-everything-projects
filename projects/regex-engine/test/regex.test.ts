import { test, expect } from "bun:test";
import { compile, match } from "../src/regex";

// (a) literal: exact match and rejection
test("literal pattern matches the exact string", () => {
  const nfa = compile("abc");
  expect(match(nfa, "abc")).toBe(true);
  expect(match(nfa, "ab")).toBe(false);
  expect(match(nfa, "abcd")).toBe(false);
  expect(match(nfa, "")).toBe(false);
});

// (b) dot matches any single character
test(". matches any single character", () => {
  const nfa = compile("a.c");
  expect(match(nfa, "abc")).toBe(true);
  expect(match(nfa, "axc")).toBe(true);
  expect(match(nfa, "a9c")).toBe(true);
  expect(match(nfa, "ac")).toBe(false);   // dot requires exactly one char
  expect(match(nfa, "axyc")).toBe(false);
});

// (c) a* matches empty string and any run of 'a's
test("a* matches empty string and repeated a", () => {
  const nfa = compile("a*");
  expect(match(nfa, "")).toBe(true);
  expect(match(nfa, "a")).toBe(true);
  expect(match(nfa, "aaaa")).toBe(true);
  expect(match(nfa, "b")).toBe(false);
  expect(match(nfa, "aab")).toBe(false);
});

// (d) a+ rejects empty string but matches non-empty runs
test("a+ rejects empty string but matches a and aaa", () => {
  const nfa = compile("a+");
  expect(match(nfa, "")).toBe(false);
  expect(match(nfa, "a")).toBe(true);
  expect(match(nfa, "aaa")).toBe(true);
  expect(match(nfa, "b")).toBe(false);
});

// (e) alternation with Star over groups
test("(ab|cd)* matches sequences of ab/cd pairs", () => {
  const nfa = compile("(ab|cd)*");
  expect(match(nfa, "")).toBe(true);
  expect(match(nfa, "ab")).toBe(true);
  expect(match(nfa, "cd")).toBe(true);
  expect(match(nfa, "abcdab")).toBe(true);
  expect(match(nfa, "cdabcd")).toBe(true);
  expect(match(nfa, "abc")).toBe(false);    // incomplete pair
  expect(match(nfa, "a")).toBe(false);
  expect(match(nfa, "abcd")).toBe(true);    // ab + cd = two complete pairs
});

// (f) a?b matches "b" and "ab" but not "aab"
test("a?b matches b and ab", () => {
  const nfa = compile("a?b");
  expect(match(nfa, "b")).toBe(true);
  expect(match(nfa, "ab")).toBe(true);
  expect(match(nfa, "aab")).toBe(false);
  expect(match(nfa, "")).toBe(false);
  expect(match(nfa, "a")).toBe(false);
});

// (g) CATASTROPHIC-BACKTRACKING SAFETY
// A backtracking engine hangs on (a*)*b against a long string of 'a's.
// The Thompson NFA must return false in linear time (well under 100 ms).
test("(a*)* b: linear-time guarantee — returns false without hanging on 30 a's", () => {
  const nfa = compile("(a*)*b");
  const start = Date.now();
  const result = match(nfa, "a".repeat(30));
  const elapsed = Date.now() - start;
  expect(result).toBe(false);
  // Linear time: must finish in under 500 ms even on slow CI machines.
  // A backtracking engine would take billions of steps here.
  expect(elapsed).toBeLessThan(500);
});
