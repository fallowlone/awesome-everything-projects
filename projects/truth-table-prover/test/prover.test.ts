import { test, expect } from "bun:test";
import { parse, evaluate, classify, equivalent } from "../src/prover";

// 1. Precedence: ! binds tighter than |
test("precedence: !a|b vs !(a|b)", () => {
  expect(evaluate(parse("!a|b"), { a: true, b: true })).toBe(true);
  expect(evaluate(parse("!(a|b)"), { a: true, b: true })).toBe(false);
});

// 2. Implication truth table
test("implication: a->b false only when a=T b=F", () => {
  expect(evaluate(parse("a->b"), { a: true, b: false })).toBe(false);
  expect(evaluate(parse("a->b"), { a: false, b: false })).toBe(true);
});

// 3. Tautology
test("classify: a|!a is tautology", () => {
  expect(classify("a|!a")).toBe("tautology");
});

// 4. Contradiction
test("classify: a&!a is contradiction", () => {
  expect(classify("a&!a")).toBe("contradiction");
});

// 5. Contingent
test("classify: a&b is contingent", () => {
  expect(classify("a&b")).toBe("contingent");
});

// 6. Equivalence: a->b === !a|b
test("equivalent: a->b and !a|b", () => {
  expect(equivalent("a->b", "!a|b")).toBe(true);
});

// 7. Non-equivalence: a&b vs a|b
test("non-equivalent: a&b and a|b", () => {
  expect(equivalent("a&b", "a|b")).toBe(false);
});

// 8. Malformed input throws
test("malformed: dangling operator a& throws", () => {
  expect(() => parse("a&")).toThrow();
});

test("malformed: unclosed paren (a throws", () => {
  expect(() => parse("(a")).toThrow();
});
