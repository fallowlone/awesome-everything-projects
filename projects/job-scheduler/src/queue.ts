// TODO(you): the durable queue core.
//
// The suite is built around the two properties that survive a worker dying:
//   1. a claim is a LEASE (expires on its own), not an `in_progress` flag that
//      nobody is left alive to clear;
//   2. claiming is single-winner, so two pollers never both take one job.
// Plus: exponential backoff with jitter, a dead-letter exit for poison pills, and
// an effect that applies exactly once even under duplicate delivery.
export type JobState = "pending" | "claimed" | "done" | "failed";

export type Job = {
  id: string;
  runAt: number;
  state: JobState;
  attempts: number;
  leaseUntil?: number;
  dedupKey?: string;
  lastError?: string;
};

export type ClaimOptions = { now: number; leaseMs: number; limit?: number };

export class JobQueue {
  enqueue(job: Omit<Job, "state" | "attempts"> & Partial<Pick<Job, "state" | "attempts">>): Job {
    void job;
    throw new Error("TODO");
  }
  get(id: string): Job | undefined {
    void id;
    return undefined; // TODO
  }
  /** Due and unclaimed, or claimed with an expired lease. */
  claimable(opts: { now: number }): Job[] {
    void opts;
    return []; // TODO
  }
  claim(opts: ClaimOptions): Job[] {
    void opts;
    return []; // TODO
  }
  heartbeat(id: string, now: number, leaseMs: number): boolean {
    void id; void now; void leaseMs;
    return false; // TODO
  }
  complete(id: string): void {
    void id; // TODO
  }
  /** Below maxAttempts → pending with a backed-off runAt; at the limit → failed. */
  fail(id: string, opts: { now: number; error: string; maxAttempts: number; backoffMs: number }): Job | undefined {
    void id; void opts;
    return undefined; // TODO
  }
  /** Returns false when the effect was already applied for this key. */
  applyEffectOnce(dedupKey: string, effect: () => void): boolean {
    void dedupKey; void effect;
    return false; // TODO
  }
  get size(): number {
    return 0; // TODO
  }
}

/** Doubling, capped, with optional full jitter (`rand` injected for testability). */
export function backoffMs(
  attempt: number,
  opts: { baseMs: number; capMs: number; rand?: () => number } = { baseMs: 1000, capMs: 60_000 },
): number {
  void attempt; void opts;
  return 0; // TODO
}
