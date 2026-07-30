import { test, expect } from "bun:test";
import { Trie } from "../src/trie";

// (a) insert → has true; has(non-inserted) false
test("has returns true for inserted word and false for non-inserted", () => {
  const t = new Trie();
  t.insert("apple");
  expect(t.has("apple")).toBe(true);
  expect(t.has("app")).toBe(false);   // prefix of 'apple', not itself
  expect(t.has("banana")).toBe(false);
});

// (b) startsWith true for real prefix, false otherwise
test("startsWith is true for real prefix and false for non-matching", () => {
  const t = new Trie();
  t.insert("apple");
  expect(t.startsWith("app")).toBe(true);
  expect(t.startsWith("apple")).toBe(true);  // a word is a prefix of itself
  expect(t.startsWith("ban")).toBe(false);
  expect(t.startsWith("")).toBe(true);       // empty prefix matches everything
});

// (c) autocomplete returns ONLY words with that prefix
test("autocomplete returns only words matching the prefix", () => {
  const t = new Trie();
  t.insert("apple", 1);
  t.insert("app", 2);
  t.insert("apt", 3);
  t.insert("banana", 4);
  const results = t.autocomplete("ap", 10);
  expect(results.sort()).toEqual(["app", "apple", "apt"]);
});

// (d) results ordered by weight descending
test("autocomplete orders by weight descending", () => {
  const t = new Trie();
  t.insert("low", 1);
  t.insert("mid", 5);
  t.insert("high", 10);
  const results = t.autocomplete("", 10);
  expect(results[0]).toBe("high");
  expect(results[1]).toBe("mid");
  expect(results[2]).toBe("low");
});

// (e) equal weights break ties lexicographically ascending
test("equal weights are broken by lexicographic ascending order", () => {
  const t = new Trie();
  t.insert("cherry", 3);
  t.insert("apple", 3);
  t.insert("banana", 3);
  const results = t.autocomplete("", 10);
  expect(results).toEqual(["apple", "banana", "cherry"]);
});

// (f) k caps the result count
test("autocomplete caps result count at k", () => {
  const t = new Trie();
  for (const w of ["one", "two", "three", "four", "five"]) t.insert(w, 1);
  expect(t.autocomplete("", 3).length).toBe(3);
  expect(t.autocomplete("", 1).length).toBe(1);
});

// (g) no-match prefix returns []
test("autocomplete on unknown prefix returns empty array", () => {
  const t = new Trie();
  t.insert("apple", 1);
  expect(t.autocomplete("xyz", 5)).toEqual([]);
  expect(t.autocomplete("z", 5)).toEqual([]);
});
