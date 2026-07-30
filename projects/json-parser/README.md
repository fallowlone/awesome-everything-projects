# JSON Parser — starter

Implement `parse` and `ParseError` in `src/parser.ts` so the acceptance suite passes.

    bun test

Rules: recursive descent, no `JSON.parse`, throw `ParseError` (with numeric
`position`) on malformed input. The suite checks primitives, nesting, all RFC 8259
string escapes (including \\uXXXX surrogate pairs), number forms (negative,
decimal, exponent), trailing commas, and unterminated strings.
When green, read the project page's rubric and push to the senior bar.
