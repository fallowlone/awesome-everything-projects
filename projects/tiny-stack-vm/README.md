# Tiny Stack VM — starter

Implement `assemble` and `run` in `src/vm.ts` so the acceptance suite passes.

    bun test

**`assemble(src)`** — two-pass assembler. Mnemonics: `PUSH <n>`, `ADD`, `SUB`,
`MUL`, `DUP`, `SWAP`, `ROT`, `JMP <label>`, `JMPIF <label>`, `CALL <label>`,
`RET`, `HALT`. Labels are `name:` lines; forward references are resolved in the
second pass.

**`run(code)`** — fetch-decode-execute loop. Returns top of value stack at
`HALT`. Throws `"stack underflow"` when a binary op finds fewer than 2 values.

When the suite is green, push to the senior bar: add a `MEM` store/load,
typed values, a disassembler, or a REPL.
