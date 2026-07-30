import { test, expect } from "bun:test";
import { parse, ParseError } from "../src/parser";

// (a) Primitives: null, true, false, number, string
test("parses null", () => {
  expect(parse("null")).toBeNull();
});

test("parses true and false", () => {
  expect(parse("true")).toBe(true);
  expect(parse("false")).toBe(false);
});

test("parses an integer", () => {
  expect(parse("42")).toBe(42);
});

test("parses a string", () => {
  expect(parse('"hello"')).toBe("hello");
});

// (b) Nested object AND array
test("parses a nested object", () => {
  const result = parse('{"a":1,"b":{"c":true}}') as Record<string, unknown>;
  expect(result["a"]).toBe(1);
  expect((result["b"] as Record<string, unknown>)["c"]).toBe(true);
});

test("parses a nested array", () => {
  const result = parse("[[1,2],[3,[4]]]") as unknown[][];
  expect(result[0]).toEqual([1, 2]);
  expect((result[1] as unknown[][])[1]).toEqual([4]);
});

// (c) String escapes: \n \t \" \\ and \uXXXX
test("decodes standard two-character escapes", () => {
  expect(parse('"\\n"')).toBe("\n");
  expect(parse('"\\t"')).toBe("\t");
  expect(parse('"\\""')).toBe('"');
  expect(parse('"\\\\"')).toBe("\\");
});

test("decodes \\uXXXX basic code point", () => {
  expect(parse('"\\u0041"')).toBe("A");
});

test("decodes \\uXXXX surrogate pair (emoji U+1F600)", () => {
  // 😀 is the surrogate-pair encoding of 😀
  expect(parse('"\\uD83D\\uDE00"')).toBe("😀");
});

// (d) Numbers: negative, decimal, exponent
test("parses a negative number", () => {
  expect(parse("-7")).toBe(-7);
});

test("parses a decimal number", () => {
  expect(parse("-1.5")).toBe(-1.5);
});

test("parses a number with exponent", () => {
  expect(parse("-1.5e3")).toBe(-1500);
});

test("parses zero", () => {
  expect(parse("0")).toBe(0);
});

// (e) Throws on a trailing comma — with position check
test("throws ParseError on trailing comma in object", () => {
  expect(() => parse('{"a":1,}')).toThrow(ParseError);
  let err: unknown;
  try { parse('{"a":1,}'); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on trailing comma in array", () => {
  expect(() => parse("[1,2,]")).toThrow(ParseError);
  let err: unknown;
  try { parse("[1,2,]"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

// (f) Throws on an unterminated string — with position check
test("throws ParseError on unterminated string", () => {
  expect(() => parse('"hello')).toThrow(ParseError);
  let err: unknown;
  try { parse('"hello'); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

// (h) RFC 8259 number rejections — invalid forms must throw ParseError with numeric position
test("throws ParseError on leading-zero number 01", () => {
  let err: unknown;
  try { parse("01"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on leading-dot number .5", () => {
  let err: unknown;
  try { parse(".5"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on trailing-dot number 1.", () => {
  let err: unknown;
  try { parse("1."); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on bare Infinity", () => {
  let err: unknown;
  try { parse("Infinity"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on bare NaN", () => {
  let err: unknown;
  try { parse("NaN"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

// (i) String escape rejections
test("throws ParseError on unknown escape \\q", () => {
  // JSON string: "\q"
  let err: unknown;
  try { parse('"\\q"'); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

test("throws ParseError on lone high surrogate \\uD83D with no low surrogate", () => {
  // JSON string: "\uD83D" — high surrogate with no following \uDC00–\uDFFF
  let err: unknown;
  try { parse('"\\uD83D"'); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

// (j) Trailing content after a valid value
test("throws ParseError on trailing content after valid value", () => {
  let err: unknown;
  try { parse("{}garbage"); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
});

// (g) ParseError.position is a number at the offending character
test("ParseError carries a numeric position", () => {
  let err: unknown;
  try {
    parse("[1,]");
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ParseError);
  expect(typeof (err as ParseError).position).toBe("number");
  // The trailing comma is at index 2 in "[1,]": [ at 0, 1 at 1, , at 2
  expect((err as ParseError).position).toBe(2);
});

test("ParseError position for unterminated string is the opening quote", () => {
  let err: unknown;
  try {
    parse('"unterminated');
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ParseError);
  expect((err as ParseError).position).toBe(0);
});
