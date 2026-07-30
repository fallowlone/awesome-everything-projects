# Tiny Stack VM

Build the machine that runs the machine. You define a small bytecode instruction set, write an assembler that turns readable mnemonics into bytes, and write the interpreter loop that fetches, decodes, and executes them one at a time. By the end you will have demystified the whole stack between a line of source and a running program — because you wrote every layer of it yourself.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** any language with arrays and integers (JS/TS, Python, Go, or C), a plain text editor for .asm test programs · **Tracks:** base-cs, algorithms

## Deliverable

A runnable VM: an assembler that compiles a text program of mnemonics into a flat bytecode array, plus an interpreter that executes that bytecode on a value stack — supporting arithmetic, conditional and unconditional jumps, and call/ret with real function frames.

## Why this project

Almost everything you run sits on top of a virtual machine you never see — the JVM, the CLR, the bytecode interpreters inside Python, Ruby, and Lua, the WebAssembly engine in your browser. They are far larger than this one, but they are made of exactly these parts: an instruction set, a fetch-decode-execute loop, a stack, call frames, and a heap. Building a tiny one strips away the mystery. After this, a stack trace is a data structure you have implemented, a segfault is a bounds check you forgot to write, and 'compilation' is a two-pass walk over text you have done with your own hands. You stop using these abstractions on faith and start understanding them from the bottom up — which is the entire point of computer science from zero.

## Skills

- designing a bytecode instruction set
- writing a two-pass assembler with label resolution
- implementing a fetch-decode-execute loop
- managing a value stack and an instruction pointer
- implementing call/ret with stack frames
- modelling a flat addressable heap

## Milestones

### 1. Design the instruction set

Before you write a single line of the VM, decide what your machine can do. An instruction set is a contract: each opcode is a number, and some opcodes carry an operand (PUSH needs a value; ADD needs nothing). Pick a handful — PUSH, POP, ADD, SUB, JMP, JZ, HALT to start — and write down, on paper or in a comment, exactly how each one changes the stack and the instruction pointer. This is the hardest thinking in the whole project precisely because it looks trivial: the moment you decide whether operands are inline bytes or a separate stream, whether the stack grows up or down, and what HALT means, you have fixed the shape of everything downstream. A muddy ISA makes a muddy interpreter.

**Definition of done:**

- Every opcode has a fixed numeric code and a one-line spec of its effect on the stack and instruction pointer.
- You can state, for any opcode, how many operands it consumes from the bytecode and how many values it pops and pushes.

### 2. The interpreter loop

This is the beating heart: a loop holding an instruction pointer that reads the opcode at the pointer, decides what it means, does it, and advances. Implement it for your arithmetic and stack opcodes first — feed it a hand-written bytecode array (no assembler yet) and watch PUSH 2, PUSH 3, ADD leave a 5 on the stack. The discipline that matters here is that the instruction pointer is just an index into an array, and that every instruction is responsible for leaving the pointer where the next fetch should happen. Get a stack underflow to fail loudly rather than silently reading garbage — an empty stack on ADD is a bug in the program being run, and your VM should say so, not crash mysteriously three instructions later.

**Definition of done:**

- A hand-built bytecode array of PUSH/POP/ADD/SUB runs to HALT and leaves the expected value on top of the stack.
- Popping from an empty stack raises a clear error naming the instruction pointer, not a silent wrong answer.

### 3. Assembler with labels

Hand-encoding bytecode gets old fast, and jumps make it unbearable: a JMP needs the numeric address of its target, but you don't know addresses until you've laid out the whole program. The classic fix is a two-pass assembler. Pass one walks the source, assigns each instruction an address, and records where every label points. Pass two emits the bytes, now able to replace 'JMP loop' with the real offset. This is the exact problem real assemblers and linkers solve, in miniature — forward references. Once it works, your jumps stop being magic numbers and become names, and you can finally write a loop in your own language.

**Definition of done:**

- A text program with a labelled jump target assembles to bytecode in which the jump operand is the resolved address.
- A jump to an undefined label fails at assemble time with the label name, not at run time with a wild pointer.

### 4. Branches and loops

Now make control flow real. JMP sets the instruction pointer outright; JZ pops a value and only jumps when it is zero — that single conditional jump is enough to express every if and every loop, just as it is in real machine code. Write a program that counts down from N and halts when it hits zero, and trace it by hand against your VM's behaviour: each iteration is the pointer leaping backward to the top of the loop. The subtle bug to hunt is the off-by-one between 'advance the pointer, then maybe jump' and 'jump replaces the advance' — decide which your loop uses and stay consistent, or your loops will run one iteration too many or skip their own bodies.

**Definition of done:**

- A countdown loop written in your assembly runs the correct number of iterations and halts.
- JZ jumps only on a zero, falls through otherwise, and both paths leave the stack in the state your spec promises.

### 5. Functions with real frames

This is where a calculator becomes a computer. CALL jumps to a function's address but first pushes a return address; RET pops that address and jumps back. The instant you support nested calls you need a call stack of frames, each frame remembering where to return and where this function's locals and arguments live. Decide your calling convention deliberately: who pushes arguments, who cleans them up, where the return value ends up. This is exactly the call stack you have read about in stack traces, now built by your own hands — and the moment recursion works, because each call gets its own frame, you will understand why a runaway recursion is called a stack overflow rather than something vaguer.

**Definition of done:**

- A program defines a function, CALLs it with an argument, and the RET returns control plus a result to the caller.
- A recursive function (e.g. factorial) computes the correct answer, and an unbounded recursion fails as a detected stack overflow, not a host crash.

### 6. A flat addressable heap

The stack is great for short-lived values, but data that must outlive a call needs a heap. Model it as the simplest thing that works: one big array of cells with ALLOC handing out a base index and a size, and LOAD/STORE reading and writing by address. No garbage collector — this is a bump allocator, so freed memory is simply never reclaimed, and that is a deliberate teaching choice. Building it by hand makes two abstractions concrete that most programmers only ever rent: that a pointer is just an integer index into memory, and that arrays and objects are layouts over contiguous cells. Wire your VM so a STORE to an out-of-bounds address is a caught VM error, and you have drawn the bright line between a controlled fault and the undefined behaviour a real machine would give you.

**Definition of done:**

- A program ALLOCs a block, STOREs values into it, LOADs them back, and the values round-trip correctly.
- A LOAD or STORE outside any allocated block is reported as a VM error naming the bad address, not silent corruption.

## Rubric

### Instruction set design

- **Junior:** Defines a handful of opcodes with numeric codes and implements PUSH, POP, ADD, SUB, and HALT; the spec is implicit (discovered by reading the interpreter source).
- **Mid:** Writes a formal one-line spec per opcode (stack effect and IP delta before the interpreter is written), separates inline operands from stack operands, and can explain the encoding trade-off: fixed-width instructions are simpler to decode but waste space; variable-width save bytes but require a length table.
- **Senior:** Reasons about dispatch overhead: a switch/case loop has a branch per opcode; a computed-goto table (or its equivalent) turns dispatch into an indirect jump. Can estimate the instruction-dispatch cost as a fraction of total execution time on a tight arithmetic loop, and knows when bytecode dispatch becomes the bottleneck relative to actual operation cost.

### Stack discipline and error handling

- **Junior:** The VM crashes with an index-out-of-bounds exception from the host language on stack underflow rather than reporting a VM-level error.
- **Mid:** Catches stack underflow and overflow at the VM layer, reports the failing instruction pointer and opcode, and distinguishes between a VM implementation bug and a program error (an underflow is always a guest program bug, not a VM bug).
- **Senior:** Detects stack depth violations at the call-frame level: unbounded recursion is reported as a stack overflow (frame count exceeded) before the host process itself overflows. Can state the failure mode if the check is absent: the guest program can overflow the host's call stack, crashing the interpreter with an uncontrolled exception that leaks VM internals.

### Two-pass assembler and label resolution

- **Junior:** Assembles programs without forward references by requiring labels to be defined before use; jumps to earlier labels work, forward jumps do not.
- **Mid:** Implements a two-pass assembler: pass one assigns addresses and builds a label table; pass two emits bytes with resolved jump targets. Forward-reference jumps work, and an undefined label fails at assemble time with the label name in the error, not at run time with a wild address.
- **Senior:** Can explain why real linkers use the same two-pass model and where relocations come in: in a multi-object scenario each object is assembled independently, producing a relocation table of unresolved references; the linker is the pass that fills them in using a global symbol table. Knows why an absolute address in the bytecode breaks position-independent code and can sketch how a load-time relocation entry solves it.

## Senior stretch

- Add a disassembler that turns bytecode back into readable mnemonics, and a single-step trace mode that prints the instruction pointer, the opcode, and the full stack after every instruction — your own debugger for your own machine.
- Replace the bump allocator with a real free list: a FREE opcode that returns blocks to a pool and an ALLOC that reuses them, then deliberately fragment the heap and watch allocation start to fail — the first lesson in why memory management is hard.
- Write a tiny compiler front end that turns a one-line expression language (e.g. '2 + 3 * 4') into your bytecode, so you have the full pipeline source → AST → bytecode → result and can feel where precedence and evaluation order actually get decided.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/tiny-stack-vm
