// TODO(you): recurring schedules without double-fires.
//
// The materialiser runs on more than one node, so two schedulers can compute the
// same run instant. Make the enqueue deterministic and idempotent: derive a key per
// firing (schedule id + BUCKETED instant, so sub-tick clock skew cannot change it)
// and let dedupe collapse the double compute into one row.
export type Schedule = { id: string; everyMs: number; startAt: number };
export type Firing = { scheduleId: string; runAt: number; dedupKey: string };

export function firingKey(scheduleId: string, runAt: number, bucketMs = 60_000): string {
  void scheduleId; void runAt; void bucketMs;
  return ""; // TODO
}

/** Every firing in [from, until], snapped to the schedule's own grid. */
export function materialise(schedule: Schedule, from: number, until: number, bucketMs = 60_000): Firing[] {
  void schedule; void from; void until; void bucketMs;
  return []; // TODO (reject everyMs <= 0)
}

export function dedupeFirings(firings: Firing[]): Firing[] {
  void firings;
  return []; // TODO
}

/** "Run at 02:30 local" is a question on a DST night. State the policy. */
export type DstPolicy = "skip" | "next" | "first";

export function resolveGapFiring(policy: DstPolicy, nextExistingInstant: number): number | null {
  void policy; void nextExistingInstant;
  return null; // TODO
}
