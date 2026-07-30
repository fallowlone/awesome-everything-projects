# Hot-Path Profiler Lab

Take a deliberately slow piece of JavaScript and turn it into a controlled experiment. You'll build a micro-benchmark harness you actually trust, profile the hot path until you can name what the engine is doing, and apply engine-aware fixes — monomorphism, killing megamorphic call sites, cutting allocations — proving each win with numbers instead of vibes. This is the whole discipline of performance work in miniature: measure, form a hypothesis about the engine, change one thing, measure again.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** node, V8 (--prof, --trace-opt, --trace-deopt), 0x or node --cpu-prof, tinybench or a hand-rolled harness, --expose-gc / process.memoryUsage / heap snapshots · **Tracks:** js-engine, node, typescript

## Deliverable

A runnable lab repo: a slow baseline hot path, a benchmark harness that reports stable per-operation timings with variance, a profiling write-up that names the engine behavior found (deopts, megamorphic ICs, allocation churn), and an optimized version with a before/after table that survives re-running.

## Why this project

Every senior engineer eventually meets a hot path that's slow for reasons no amount of staring at the source reveals — because the cost lives in the engine, not the code you wrote. This lab builds the one habit that separates real performance work from cargo-culting: you never claim a win you can't measure, and you never measure without a hypothesis about why. By the end you won't just have a faster function; you'll be able to point at a deopt log, a megamorphic call site, or an allocation spike and say exactly what the engine was doing and what you changed to make it stop. That ability — turning 'it feels faster' into 'here is the number and here is the cause' — is what makes performance work trustworthy.

## Skills

- building a trustworthy micro-benchmark harness
- reading CPU and allocation profiles
- diagnosing megamorphic call sites and deopts
- shaping objects for monomorphism
- reducing allocation and GC pressure
- attributing a speedup to a specific engine mechanism

## Milestones

### 1. A slow baseline you can measure

Before you optimize anything, you need a number you can defend. Take the provided slow hot path (or write one: a function that gets called in a tight loop and does too much) and wrap it in a micro-benchmark harness. The hard part isn't running the function a million times — it's making the result mean something. Warm up the function so you're timing optimized code, not the interpreter. Run enough iterations that timer resolution stops dominating. Report not just a mean but the variance, because a benchmark with a 40% spread is telling you it can't be trusted yet. Resist the urge to optimize here; the only goal is a stable, repeatable baseline.

**Definition of done:**

- Running the harness twice in a row produces means within a few percent of each other, with reported variance.
- The harness includes a warm-up phase and times only the steady-state hot path, not setup.

### 2. Profile until you can name the problem

A profile that just says 'this function is slow' is useless — you already knew that. The point is to come out able to say why, in the engine's vocabulary. Run a CPU profile and find where the time actually goes; it's rarely where you guessed. Then run V8 with --trace-opt and --trace-deopt and watch what happens to your hot function: does it get optimized and then thrown back (deoptimized) on every other call? A deopt loop means TurboFan keeps betting on a shape and losing. Write down your findings as hypotheses you can test — 'this call site is megamorphic', 'this object changes shape mid-loop', 'we deopt because of a NaN' — not as a vague 'it's slow'.

**Definition of done:**

- A CPU profile pinpoints the dominant cost, and the write-up names at least one concrete engine cause (a deopt reason, a megamorphic site, or allocation in the loop).
- --trace-opt/--trace-deopt output is captured and the behavior of the hot function (optimized, deopted, or stuck in the interpreter) is explained.

### 3. Make the call sites monomorphic

Most JS hot-path slowness comes down to the engine never being sure what shape it's dealing with. When a property access or call site sees one object shape, V8 builds a monomorphic inline cache and the access is nearly free; when it sees many shapes it goes megamorphic and falls back to a slow lookup on every hit. Your job is to find the polymorphism and remove it: initialize all object properties in the same order so every object shares one hidden class, stop adding fields after construction, and don't pass three different object shapes through the same function. Change one source of polymorphism at a time and re-run the harness — you want to attribute the speedup to monomorphism specifically, not to a bundle of edits you can't untangle.

**Definition of done:**

- The hot call sites are shown to be monomorphic (one shape) where they were polymorphic or megamorphic before.
- The harness shows a measurable improvement attributable to this change alone, with the diff isolated to shape-related edits.

### 4. Cut the allocations in the loop

Now go after the garbage you create on every iteration. A hot loop that allocates a fresh array, object, or closure each pass isn't just paying for the allocation — it's feeding the young generation until a scavenge fires, and those pauses show up as jitter in your timings. Find the per-iteration allocations: intermediate arrays from map/filter chains, objects built only to be read once, strings concatenated in a loop, closures created inside the hot function. Hoist what you can out of the loop, reuse buffers, and prefer a plain loop where a functional chain was quietly allocating. The trap here is going too far and writing unreadable code for a win that doesn't show up — let the harness, not your instinct, tell you which allocations actually cost.

**Definition of done:**

- Per-iteration allocations are reduced and the change is visible as lower allocation rate or fewer/cheaper GC pauses.
- The optimized loop is still readable and the harness confirms the allocation cut actually moved the timing.

### 5. Prove the win, then defend it

Optimization that you can't prove isn't engineering — it's superstition. Assemble the before/after story so a skeptical reviewer would believe it: a table of baseline vs. optimized timings with variance, the profile that motivated each change, and a one-line cause for each speedup ('monomorphic IC', 'no deopt', 'fewer scavenges'). Then attack your own result — re-run on a quiet machine, swap the input data, and check that the win holds rather than being a fluke of one dataset or a warm cache. The senior move is honesty: if one of your 'optimizations' turns out to be noise, say so and drop it. A smaller win you can defend beats a bigger number nobody can reproduce.

**Definition of done:**

- A before/after table with variance shows a real, repeatable speedup, and each row is tied to a named engine cause.
- The win survives a second dataset and a re-run; any change that turned out to be noise is dropped from the claim.

## Rubric

### Benchmark trustworthiness

- **Junior:** Times the function by wrapping it in Date.now() calls across a large iteration count and reports a single mean.
- **Mid:** Includes a warm-up phase so the JIT reaches steady state before timing begins, runs multiple batches, and reports variance alongside the mean — a spread wider than ~5% is treated as a signal the harness itself is noisy.
- **Senior:** Guards against dead-code elimination (sinks the result so V8 can't prove it's unused), pins CPU frequency or documents that it was not pinned, and can explain why timer resolution limits the minimum meaningful iteration count for a given workload.

### Engine-level diagnosis

- **Junior:** Runs a CPU profile and identifies the function that occupies the most wall-clock time on the flamegraph.
- **Mid:** Uses --trace-opt and --trace-deopt to determine whether the hot function is optimized by TurboFan, repeatedly deopted, or stuck in the interpreter; names the deopt reason from the log rather than guessing.
- **Senior:** Identifies megamorphic inline caches via --trace-ic or a heap snapshot (more than 4 distinct shapes at one property access site), distinguishes a deopt loop (optimise → bail out → re-optimise) from a stable interpreter path, and can trigger a specific deopt on purpose to verify the hypothesis.

### Allocation and GC hot paths

- **Junior:** Removes obvious per-iteration object creation (intermediate arrays from map/filter) and re-runs the harness to see if timing improved.
- **Mid:** Measures allocation rate directly (--expose-gc + process.memoryUsage delta or --trace-gc) before and after changes, and correlates scavenge frequency with the iteration timing rather than relying on wall-clock feel.
- **Senior:** Attributes each allocation-reduction change to a specific GC mechanism: moving a closure out of the loop reduces nursery churn; reusing a typed array eliminates repeated promotion to old-gen; a closure that captures a large outer scope can prevent collection of the whole scope — can identify this from a heap snapshot's retainer tree.

### Win attribution and reproducibility

- **Junior:** Reports a faster timing after changes and concludes the optimization worked.
- **Mid:** Isolates each change to a separate benchmark run, produces a before/after table with variance for each, and rolls back changes that didn't improve timing, keeping the narrative honest.
- **Senior:** Ties each speedup row in the table to a specific engine mechanism ('TurboFan now compiles the site', 'scavenge rate dropped from 12/s to 1/s', 'IC went monomorphic'), re-runs on a different dataset to confirm the win is not input-specific, and drops any claim that fails re-run within ~5% variance.

## Senior stretch

- Quantify GC pressure directly: capture allocation rate and pause times (via --trace-gc or performance hooks) before and after, and show the allocation cut as a drop in scavenge frequency, not just a faster wall-clock.
- Add a guard against regressions: wire the harness into a script that fails if the hot path gets slower than a threshold, so a future refactor that reintroduces a deopt or megamorphic site is caught automatically.
- Force and then explain a deopt on purpose: introduce a value that breaks TurboFan's speculation (a hidden NaN, a sudden new shape), capture the deopt reason, and show you can read the engine's own explanation of why it gave up.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/hotpath-profiler-lab
