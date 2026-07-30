import { test, expect } from "bun:test";
import { materialise, dedupeFirings, firingKey, resolveGapFiring, type Schedule } from "../src/cron";

const every5min: Schedule = { id: "sweep", everyMs: 300_000, startAt: 0 };

test("materialise emits every firing in the window", () => {
  const out = materialise(every5min, 0, 900_000);
  expect(out.map((f) => f.runAt)).toEqual([0, 300_000, 600_000, 900_000]);
});

test("materialise snaps to the schedule's own grid, not to the window start", () => {
  // Asking from 100_000 must not invent a firing at 100_000; the schedule fires on
  // multiples of everyMs from startAt.
  const out = materialise(every5min, 100_000, 700_000);
  expect(out.map((f) => f.runAt)).toEqual([300_000, 600_000]);
});

test("materialise never fires before startAt", () => {
  const later: Schedule = { id: "s", everyMs: 1000, startAt: 5000 };
  expect(materialise(later, 0, 7000).map((f) => f.runAt)).toEqual([5000, 6000, 7000]);
});

test("materialise rejects a non-positive interval", () => {
  expect(() => materialise({ id: "s", everyMs: 0, startAt: 0 }, 0, 10)).toThrow();
});

test("two schedulers computing the same window produce identical keys", () => {
  // This is the property that lets a unique constraint collapse a double compute.
  const a = materialise(every5min, 0, 600_000);
  const b = materialise(every5min, 0, 600_000);
  expect(a.map((f) => f.dedupKey)).toEqual(b.map((f) => f.dedupKey));
});

test("dedupeFirings collapses a doubled minute to one row", () => {
  const a = materialise(every5min, 0, 600_000);
  const b = materialise(every5min, 0, 600_000);
  const merged = dedupeFirings([...a, ...b]);
  expect(merged).toHaveLength(a.length);
});

test("sub-bucket clock skew does not change the key", () => {
  // Node A thinks it is 09:00:00.000, node B 09:00:00.400. Same intended minute ⇒
  // same key, so skew cannot smuggle in a second enqueue.
  expect(firingKey("sweep", 540_000, 60_000)).toBe(firingKey("sweep", 540_400, 60_000));
  // A genuinely different minute still gets its own key.
  expect(firingKey("sweep", 540_000, 60_000)).not.toBe(firingKey("sweep", 600_000, 60_000));
});

test("keys are per schedule, so two schedules firing together stay distinct", () => {
  expect(firingKey("a", 60_000)).not.toBe(firingKey("b", 60_000));
});

test("a DST gap has an explicit, stated policy rather than a silent skip", () => {
  // "Run at 02:30 local" is a question on the night the clock jumps: 02:30 does not
  // exist. The code must answer deliberately, not by accident.
  expect(resolveGapFiring("skip", 9_000)).toBeNull();
  expect(resolveGapFiring("next", 9_000)).toBe(9_000);
});
