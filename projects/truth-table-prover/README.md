# Truth-Table Prover — starter

Implement `parse`, `evaluate`, `classify`, and `equivalent` in `src/prover.ts` so
the acceptance suite passes.

    bun test

Rules: ASCII operators `!` `&` `|` `->` `<->`, single lowercase-letter variables,
parentheses. Precedence high→low: `!` > `&` > `|` > `->` > `<->`. `parse` must
throw on malformed input. `classify` enumerates all 2^n assignments. When the suite
is green, read the project page's rubric and push to the senior bar (CNF/DNF
normal forms, equivalence-via-biconditional proof, parser error recovery).
