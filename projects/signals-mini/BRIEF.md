# Signals mini

Build a ~100-line reactive signals library (signal/computed/effect) with automatic dependency tracking and glitch-free batched updates — the same model that powers Solid, Preact Signals, and Vue 3.

**Difficulty:** intermediate · **Est. days:** 3 · **Stack:** typescript, vitest · **Tracks:** frontend

## Deliverable

A library where signal → computed → effect chains update exactly once per batch, with a test suite that proves no stale reads and no glitches.

## Why this project

Every modern reactive framework uses some variant of signals. By building one from scratch you'll understand exactly how dependency tracking works (the 'currently-executing' trick), why glitches happen in naive implementations, and how topological ordering and batching fix them. 100 lines of TypeScript, but the concepts scale to Vue reactivity and Solid's fine-grained updates.

## Skills

- reactive graph / pull-push model
- dependency tracking via execution context
- topological sort for glitch-free updates
- batching

## Milestones

### 1. signal() + effect() with auto-tracking

Implement signal() and effect(): use a global 'currently-executing' variable to auto-track reads and re-run effects on writes.

**Definition of done:**

- Reading a signal inside an effect auto-subscribes it; writing the signal re-runs exactly the dependent effects.
- An effect that stops reading a signal is no longer re-run by it (dependencies are dynamic).

### 2. Lazy cached computed()

Add computed(): lazy, cached, and only recomputed when a source signal actually changed.

**Definition of done:**

- A computed recomputes only when a source actually changed and is cached between reads otherwise.
- A computed read inside an effect tracks transitively through the computed to its sources.

### 3. Glitch-free batching

Implement batching so that multiple signal writes inside batch(() => {...}) trigger each effect exactly once.

**Definition of done:**

- Multiple writes inside batch(() => …) re-run each effect exactly once, after all writes.
- A diamond dependency (A→B, A→C, B&C→D) updates D once with no stale intermediate read.

## Rubric

### Dependency tracking mechanism

- **Junior:** Effects are re-run by subscribing explicitly (effect.subscribe(signal)); no automatic tracking — the developer must list every dependency by hand.
- **Mid:** A global 'currently-executing' variable auto-tracks reads: any signal read inside an effect's function body is registered as a dependency without explicit listing.
- **Senior:** Dependencies are dynamic: before each re-run the previous subscriber set is cleared so a signal conditionally read in one branch does not keep the effect subscribed when the branch is no longer taken. You can show a test where a signal that stops being read stops triggering the effect.

### Glitch-free / topological propagation

- **Junior:** Effects are re-run immediately on each signal write; a diamond dependency (A→B, A→C, B&C→D) causes D to run twice and may read a stale intermediate value on the first run.
- **Mid:** Multiple writes inside batch() trigger each effect exactly once, after all writes; D updates once without a stale read when A changes inside a batch.
- **Senior:** The reactive graph is sorted topologically before flushing so a computed is never evaluated while any of its sources are still dirty; you can prove this with the diamond test and explain why naive BFS/push propagation produces glitches without topological ordering.

### Computed caching & lazy evaluation

- **Junior:** computed() re-evaluates on every read, regardless of whether any source signal has changed since the last read.
- **Mid:** computed() is lazy (only evaluates on read) and cached (returns the last value if no source changed); it re-evaluates only when marked dirty by a source write.
- **Senior:** A computed read inside an effect tracks transitively through the computed to its source signals, so the effect subscribes to the sources — not just the computed node. You can show that changing a source causes the computed to be marked dirty, the effect to be scheduled, and the computed to re-evaluate exactly once on the next flush.

## Senior stretch

- Prove glitch-freedom: sort the reactive graph topologically before flushing so a computed is never read while its sources are dirty.
- Add untrack() to read a signal without subscribing, and onCleanup() so effects can release resources before re-running.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/signals-mini
