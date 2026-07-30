// TODO(you): implement a tiny stack-based virtual machine.
//
// assemble(src: string): number[]
//   Two-pass assembler over a mnemonic language:
//     PUSH <n>         – push integer n onto the stack
//     ADD / SUB / MUL  – pop two, push result
//     JMP  <label>     – unconditional jump
//     JMPIF <label>    – pop top; jump if non-zero
//     CALL <label>     – push return address, jump to label
//     RET              – pop return address, jump there
//     HALT             – stop execution
//   Labels are `name:` lines; a second pass resolves forward references.
//
// run(code: number[]): number
//   Fetch-decode-execute loop. Returns the top of the value stack at HALT.
//   Throws "stack underflow" when a binary op finds fewer than 2 operands.

export function assemble(_src: string): number[] {
  void _src;
  return []; // TODO
}

export function run(_code: number[]): number {
  void _code;
  return 0; // TODO
}
