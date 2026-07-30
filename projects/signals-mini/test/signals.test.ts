import { test, expect } from "bun:test";
import { signal, computed, effect, batch } from "../src/signals";

// (a) Effect runs on registration, then re-runs when a dependency changes.
test("effect runs once on registration then re-runs on signal change", () => {
  const s = signal(1);
  const seen: number[] = [];
  effect(() => seen.push(s.get()));
  expect(seen).toEqual([1]);           // ran once on registration
  s.set(2);
  expect(seen).toEqual([1, 2]);        // re-ran after set
  s.set(3);
  expect(seen).toEqual([1, 2, 3]);
});

// (b) Computed is lazy and cached — recomputes only when a dep actually changed.
test("computed is lazy and cached — counts invocations", () => {
  const s = signal(10);
  let calls = 0;
  const c = computed(() => { calls++; return s.get() * 2; });

  expect(calls).toBe(0);              // not called yet (lazy)
  expect(c.get()).toBe(20);
  expect(calls).toBe(1);
  expect(c.get()).toBe(20);           // cached — same dep, no recompute
  expect(calls).toBe(1);
  s.set(5);
  expect(c.get()).toBe(10);           // dirty now → recomputes
  expect(calls).toBe(2);
  expect(c.get()).toBe(10);           // cached again
  expect(calls).toBe(2);
});

// (c) Diamond graph: a → (b, c) → d updates d EXACTLY ONCE per change to a.
test("diamond graph: d evaluates exactly once per update to a (glitch-free)", () => {
  const a = signal(1);
  const b = computed(() => a.get() + 1);
  const c = computed(() => a.get() * 2);
  let dCalls = 0;
  const values: number[] = [];
  effect(() => {
    dCalls++;
    values.push(b.get() + c.get());
  });
  const initialCalls = dCalls;        // 1 from registration
  a.set(3);
  // b = 4, c = 6 → d = 10; must fire exactly once more
  expect(dCalls).toBe(initialCalls + 1);
  expect(values[values.length - 1]).toBe(10);
});

// (d) Dynamic dependencies: after cond flips, setting y no longer triggers effect.
test("dynamic deps: effect stops depending on y after cond flips to true", () => {
  const cond = signal(false);
  const x = signal(10);
  const y = signal(20);
  const seen: number[] = [];
  effect(() => seen.push(cond.get() ? x.get() : y.get()));

  expect(seen).toEqual([20]);         // cond=false → reads y

  y.set(99);
  expect(seen).toEqual([20, 99]);     // y changed → re-run (still in false branch)

  cond.set(true);                     // now reads x, forgets y
  seen.length = 0;

  y.set(42);                          // y changed but effect no longer depends on it
  expect(seen).toEqual([]);           // must NOT re-run
  x.set(5);
  expect(seen).toEqual([5]);          // x changed → re-run
});

// (e) batch coalesces multiple sets → dependent effect runs once at the end.
test("batch: multiple signal sets trigger dependent effect exactly once", () => {
  const a = signal(0);
  const b = signal(0);
  const log: string[] = [];
  effect(() => log.push(`${a.get()}:${b.get()}`));

  log.length = 0;                     // clear the registration run
  batch(() => {
    a.set(1);
    a.set(2);
    b.set(3);
  });
  expect(log.length).toBe(1);         // exactly one flush
  expect(log[0]).toBe("2:3");         // sees final values
});
