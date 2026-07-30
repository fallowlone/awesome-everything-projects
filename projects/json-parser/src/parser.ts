// TODO(you): implement a spec-correct recursive-descent JSON parser.
//
// Exports:
//   parse(input: string): JsonValue  — parses a JSON document; throws ParseError on malformed input
//   ParseError                        — Error subclass with a numeric `position` property
//
// JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue }
//
// Milestone guide:
//   1. tokenizer    — scan input into typed tokens, each with a `position`
//   2. values       — parseValue dispatcher + parseObject + parseArray (literals work)
//   3. strings      — decode all RFC 8259 escapes including \uXXXX surrogate pairs
//   4. numbers      — validate lexeme against JSON grammar before Number()
//   5. nesting      — depth cap, EOF position, trailing-content detection
//   6. spec-edges   — conformance suite, round-trip, adversarial inputs

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export class ParseError extends Error {
  constructor(message: string, public readonly position: number) {
    super(message);
    this.name = "ParseError";
  }
}

export function parse(_input: string): JsonValue {
  // TODO: implement
  throw new ParseError("not implemented", 0);
}
