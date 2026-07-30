import { test, expect } from "bun:test";
import { assemble, run } from "../src/vm";

function exec(src: string): number {
  return run(assemble(src));
}

// (a) Basic arithmetic
test("PUSH + ADD returns 5", () => {
  expect(exec("PUSH 2\nPUSH 3\nADD\nHALT")).toBe(5);
});

// (b) Backward-jump loop: sum 1..5 = 15
// Stack invariant: [acc, n] where n is on top.
// Each iteration: DUP n, ROT to expose acc, ADD, SWAP back, decrement n, DUP, JMPIF.
// After loop exits (n==0): ADD 0 to acc to clean up.
test("backward-jump loop sums 1..5 to 15", () => {
  const src = `
PUSH 0
PUSH 5
loop:
DUP
ROT
ADD
SWAP
PUSH 1
SUB
DUP
JMPIF loop
ADD
HALT
`.trim();
  expect(exec(src)).toBe(15);
});

// (c1) JMPIF takes the branch when top is non-zero
test("JMPIF jumps when top is non-zero", () => {
  const src = `
PUSH 1
JMPIF done
PUSH 0
done:
PUSH 99
HALT
`.trim();
  expect(exec(src)).toBe(99);
});

// (c2) JMPIF falls through when top is zero
test("JMPIF falls through when top is zero", () => {
  const src = `
PUSH 0
JMPIF skip
PUSH 42
HALT
skip:
PUSH 0
HALT
`.trim();
  expect(exec(src)).toBe(42);
});

// (d) CALL/RET: subroutine doubles top of stack via DUP + ADD
test("CALL/RET subroutine doubles the top", () => {
  const src = `
PUSH 7
CALL double
HALT
double:
DUP
ADD
RET
`.trim();
  expect(exec(src)).toBe(14);
});

// (e) Stack underflow errors
test("ADD with only one stack value throws stack underflow", () => {
  expect(() => exec("PUSH 1\nADD\nHALT")).toThrow(/underflow/i);
});

test("ADD on empty stack throws stack underflow", () => {
  expect(() => exec("ADD\nHALT")).toThrow(/underflow/i);
});

// (f) Forward JMP resolves via two-pass assembler
test("forward JMP to a label defined later resolves correctly", () => {
  const src = `
JMP target
PUSH 0
target:
PUSH 99
HALT
`.trim();
  expect(exec(src)).toBe(99);
});
