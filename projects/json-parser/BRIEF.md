# JSON parser from scratch

Write a spec-correct recursive-descent parser for JSON — tokenizer, value dispatcher, escape handler, number decoder — and watch every edge case in RFC 8259 become a concrete code path.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** typescript · **Tracks:** algorithms, typescript

## Deliverable

A `parse(input)` function that correctly handles all JSON value types, string escapes including \uXXXX, all number forms, arbitrary nesting depth, and throws a `ParseError` with a numeric `position` on any malformed input.

## Why this project

Writing a JSON parser from scratch is the canonical exercise in recursive-descent parsing: the grammar is small enough to hold in your head but large enough to contain every practical challenge — tokenization, escape decoding, numeric precision, error reporting, and recursion depth. Unlike parsing tutorials that stop at 'it mostly works', this project demands RFC 8259 correctness: every escape sequence, every number form, a `ParseError` with a real position, and a round-trip guarantee.

## Skills

- recursive descent parsing
- tokenizer design
- unicode escape decoding
- IEEE 754 number parsing
- error reporting with position

## Milestones

### 1. Tokenizer: scan the input into a token stream

Before you parse structure, you need to classify characters. A tokenizer (lexer) walks the raw input string character by character, skips whitespace, and emits a flat stream of typed tokens: LEFT_BRACE, RIGHT_BRACE, LEFT_BRACKET, RIGHT_BRACKET, COLON, COMMA, STRING, NUMBER, TRUE, FALSE, NULL, and EOF. The critical decision is what information each token carries: structural tokens carry only their type and position; STRING tokens carry the raw lexeme so the escape-decoder in a later milestone can reprocess it; NUMBER tokens carry the raw lexeme so the numeric decoder can validate format before converting. Recording the character offset of every token here is what makes `position` in your `ParseError` honest later — do not defer position tracking. A tokenizer that returns a rich token stream makes the recursive-descent parser in the next milestone trivial to write; a tokenizer that hands back raw indices makes the parser a mess.

**Definition of done:**

- Given any valid JSON string, the tokenizer emits the correct sequence of typed tokens, each with a `position` (character offset into the input).
- Given a malformed input (e.g. a bare `@` or an unterminated string), the tokenizer throws a `ParseError` whose `position` points at the offending character.

**Self-review:** Show the token stream for `{"x":1}` and for `"ab\ncd"` — a senior reviewer checks each token has a position, STRING carries the raw lexeme, and that unterminated strings are caught in the tokenizer, not the parser.

### 2. Value dispatcher: literals, arrays, and objects

The heart of a recursive-descent parser is a `parseValue` function that looks at the current token and dispatches to the correct sub-rule: if it sees LEFT_BRACE it calls `parseObject`, if LEFT_BRACKET it calls `parseArray`, if NULL/TRUE/FALSE it returns the literal immediately, if STRING/NUMBER it defers to specialized handlers (next milestones). `parseObject` consumes tokens in the shape `{ key : value (, key : value)* }` and recurses into `parseValue` for each value; `parseArray` does the same for `[ value (, value)* ]`. The recursion is the spec: a JSON value is defined as any of those six forms, and objects and arrays contain values — so they naturally call back into `parseValue`. A missing comma, a key that is not a string, or a token that is not a valid value starter must all produce a `ParseError` pointing at the offending token's position.

**Definition of done:**

- Parses `null`, `true`, `false`, a flat array `[1,2,3]`, and a flat object `{"a":1}` correctly, returning the right JavaScript/TypeScript values.
- Throws `ParseError` with a meaningful `position` on a trailing comma in an array or object, and on an object key that is not a string.

**Self-review:** Trace the call stack for parsing `[true,{"k":null}]` through `parseValue` → `parseArray` → `parseValue` → `parseObject`; a senior reviewer checks the recursion terminates correctly at EOF and that `parseObject` distinguishes a missing colon from a missing comma with different error messages.

### 3. String decoder: escapes and \uXXXX

JSON strings are not JavaScript strings: the raw lexeme from the tokenizer is a byte sequence wrapped in quotes, and you must decode it. RFC 8259 defines eight two-character escapes (\" \\ \/ \b \f \n \r \t) that map to single characters, and a six-character \uXXXX form that decodes a Unicode code point. The `\uXXXX` form is where most implementations go wrong: a value in the surrogate range (U+D800–U+DFFF) is not a standalone character; a high surrogate (D800–DBFF) must be followed immediately by `\uXXXX` low surrogate (DC00–DFFF), forming a surrogate pair that decodes to a supplementary plane character via `String.fromCodePoint`. Feeding a lone surrogate to `String.fromCharCode` produces a mangled string that will fail JSON.stringify round-trip. Any unrecognized `\x` sequence is an error under the spec, not a pass-through. The string decoder is pure: it takes the raw lexeme and returns a decoded string, making it independently testable.

**Definition of done:**

- All eight RFC 8259 escapes (`\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`) decode to the correct single characters.
- A `\uXXXX` sequence decodes correctly, including a surrogate pair (e.g. `\uD83D\uDE00` → emoji 😀), and an unrecognized escape (e.g. `\q`) throws `ParseError`.

**Self-review:** Show the decode output for `"\t\u0041\uD83D\uDE00"` (tab + 'A' + 😀) — a senior reviewer checks the surrogate pair is combined via `String.fromCodePoint`, not two broken surrogates via `String.fromCharCode`, and that `\q` produces a `ParseError` rather than the literal characters `\q`.

### 4. Number decoder: sign, decimal, and exponent

JSON numbers have a defined grammar — `[-](0|[1-9][0-9]*)([.][0-9]+)?([eE][+-]?[0-9]+)?` — and not all strings that JavaScript's `parseFloat` happily swallows are valid JSON numbers. `Infinity`, `NaN`, and bare `.5` (a leading dot) are not JSON. `01` (leading zero followed by digit) is not JSON. Your number decoder must validate the raw lexeme against the JSON grammar before passing it to `Number()` or `parseFloat`, because those functions are lenient in ways the spec is not. Edge cases to handle: negative zero (`-0`), which is valid JSON and must round-trip correctly; very large exponents (e.g. `1e308`) which are valid JSON but may underflow or overflow to `Infinity` on the JavaScript side — your parser is correct to return `Infinity` here because that is the nearest IEEE 754 representation; and numbers whose decimal precision exceeds 64-bit float precision, where you accept the nearest representable value and do not try to preserve exact decimal semantics (that would require a BigDecimal).

**Definition of done:**

- All valid JSON number forms parse correctly: integers, negative integers, decimals (`-1.5`), exponents (`2e10`, `1.5E-3`), and combined forms (`-1.5e3`).
- Invalid forms (`Infinity`, `NaN`, `01`, `.5`) throw `ParseError`; negative zero (`-0`) parses without throwing and `Object.is(result, -0)` is true.

**Self-review:** Show what your decoder does with `01`, `-0`, and `1e999` — a senior reviewer checks `01` is a `ParseError` (not 1), `-0` passes `Object.is(result, -0)`, and `1e999` returns `Infinity` without throwing (valid JSON, representable as IEEE 754).

### 5. Nesting depth, EOF handling, and error positions

The recursive-descent structure handles nesting for free — `parseValue` calls `parseObject` which calls `parseValue` which calls `parseArray` and so on — but you must ensure the recursion is bounded or a deeply nested input crashes the process with a stack overflow. A hard depth cap (e.g. 500 levels, matching V8's typical limit minus headroom) turns a stack overflow into a `ParseError` at the right position. EOF errors are the second class of position bugs: when the parser expects more tokens and sees EOF, the reported position should be the end of the input, not index 0. Trailing content is an error: `parse('{}garbage')` must throw because a well-formed JSON text is exactly one value with no trailing non-whitespace. The error-reporting contract is what your callers rely on for user-facing diagnostics — a `ParseError` whose `position` is 0 for every error is useless.

**Definition of done:**

- An input with 200 levels of nesting parses without stack overflow; an input that exceeds the depth cap throws `ParseError` at the nesting point.
- Trailing content (`{}garbage`), unterminated input (`{"a":`), and deeply nested empty arrays produce `ParseError` whose `position` points at the actual problematic character, not at 0 or end-of-file unconditionally.

**Self-review:** Run your parser on `'{' + '['.repeat(1000)` — a senior reviewer checks it throws a `ParseError` naming a depth-exceeded condition rather than crashing with a call stack size error, and that `position` is non-zero (at the point where nesting exceeded the cap).

### 6. Spec edges: conformance, round-trip, and adversarial inputs

A parser that passes your own happy-path tests is not the same as one that passes RFC 8259. Run your implementation against a JSON conformance suite (e.g. the JSONTestSuite by Nicolas Seriot or the Parsing JSON is a Minefield article's test vectors) and record which of its 'must-fail' and 'must-pass' cases you pass. The interesting failures are the ambiguous cases: byte-order marks at the start of the input, duplicate keys in an object (the spec says 'should' be unique, not 'must'), numbers with very long integer parts, and valid single-value documents that are just a number or string (not an object or array). Round-trip your implementation: for every JSON value you can parse, `parse(JSON.stringify(value))` must return a value that `JSON.stringify` maps back to the same string. Adversarial inputs — deeply nested inputs, strings with every escape form, objects with 10k keys — must not cause quadratic-time concatenation or unbounded memory allocation.

**Definition of done:**

- Your parser passes all 'must-pass' cases from at least one public JSON conformance suite and you documented which 'must-fail' cases you pass and which you accept (with rationale for the latter).
- Round-trip holds: `parse(JSON.stringify(x))` ≡ `x` for `null`, `true`, `false`, any finite number, any string without surrogate values, and any nested structure built from those.

**Self-review:** Run `parse(JSON.stringify({a: [1, '\u0000', null, true]}))` and show the result equals the original — a senior reviewer checks you handle the null byte (`\u0000`) correctly in round-trip and that you can name one RFC 8259 ambiguity (duplicate keys, BOM, number precision) and state your parser's explicit policy on it.

## Rubric

### Tokenizer & grammar correctness

- **Junior:** Parses simple objects and arrays with string keys and integer values; fails on nested structures, non-integer numbers, or any escape beyond `\n`.
- **Mid:** Tokenizer emits a typed token stream with positions; recursive-descent handles all six JSON value types and arbitrary nesting; `ParseError` is thrown on structural violations (missing comma, wrong token) with a non-zero position.
- **Senior:** Parser passes all must-pass cases from a public JSON conformance suite, has an explicit policy on RFC 8259 ambiguities (duplicate keys, BOM), and you can show the depth cap converting a stack overflow into a `ParseError` at the correct position.

### Escapes & number formats

- **Junior:** Handles `\n` and `\t`; passes raw digits to `parseInt`; does not validate number format against the JSON grammar.
- **Mid:** All eight RFC 8259 two-character escapes decode correctly; `\uXXXX` single code points decode correctly; number lexeme is validated against the JSON grammar before conversion; negative and decimal forms work.
- **Senior:** Surrogate pairs (`\uD800\uDC00`) are combined via `String.fromCodePoint` not two broken `fromCharCode` calls; lone surrogates throw; exponent forms and `-0` are handled; round-trip holds for all non-surrogate values that `JSON.stringify` produces.

### Error reporting with position

- **Junior:** Throws a generic `Error` or returns `null` on bad input; no position information; distinguishing the error type requires inspecting the message string.
- **Mid:** Throws a `ParseError` subclass with a numeric `position` property that is the character offset of the first bad character; calling code can `instanceof ParseError` to distinguish parse failures from other errors.
- **Senior:** Position is correct for every error class: unterminated string (position of the opening quote), trailing comma (position of the comma), unknown escape (position of the backslash), depth exceeded (position of the token that would start the too-deep level), and trailing content (position of the first non-whitespace after the top-level value).

## Senior stretch

- Implement an incremental/streaming mode: accept chunks of input and emit complete JSON values as they are parsed, without buffering the entire document — useful for large NDJSON streams where you cannot afford to hold the full input in memory.
- Add a schema-validated parse: accept a JSON Schema (subset: type, properties, required, items, minimum/maximum) alongside the input and throw a typed `ValidationError` instead of returning a plain `JsonValue` when the parsed document violates the schema.
- Measure parse throughput (MB/s) against `JSON.parse` on a 10 MB document and identify the hottest path — likely string decoding or object-key hashing — then optimize it, showing before/after throughput numbers.
- Handle number precision: expose a `parseWithBigInt` variant that returns `bigint` instead of `number` for integer values that exceed `Number.MAX_SAFE_INTEGER`, and prove no precision is lost for a 64-bit integer value the standard `parse` would corrupt.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/json-parser
