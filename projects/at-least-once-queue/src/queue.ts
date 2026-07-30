// TODO(you): implement an in-memory at-least-once job queue with an injected clock.
// The queue leases jobs with a visibility timeout. An unacked job whose lease has
// expired is re-delivered on the next claim — that is the at-least-once guarantee.
// No Date.now(), no IO, no external dependencies.

export interface Job {
  id: string;
  key?: string;
  payload?: unknown;
  attempts: number;
}

export interface QueueOptions {
  visibilityMs: number;
  maxAttempts: number;
}

export class Queue {
  constructor(opts: QueueOptions) {
    // TODO: store opts; initialise pending list, dead-letter list, processed-key set.
    void opts;
  }

  /** Add a job to the queue. Auto-generates an id if job.id is omitted. */
  enqueue(job: { id?: string; key?: string; payload?: unknown }): Job {
    // TODO: create a Job record, append to pending list, return it.
    void job;
    return { id: "", attempts: 0 };
  }

  /**
   * Claim the next available (not currently leased) job.
   * Grants a lease expiring at now + visibilityMs.
   * Returns null when nothing is claimable.
   */
  claim(now: number): Job | null {
    // TODO: find first job whose lease is absent or expired; set its lease deadline
    //       to now + visibilityMs; return the job. Return null if none found.
    void now;
    return null;
  }

  /** Acknowledge successful processing — removes the job permanently. */
  ack(id: string): void {
    // TODO: remove the job with this id from pending.
    void id;
  }

  /**
   * Negative-acknowledge: increment attempts and release the lease so the job
   * can be re-claimed. If attempts exceed maxAttempts, move to dead-letter.
   */
  nack(id: string): void {
    // TODO: increment job.attempts; if > maxAttempts move to dead-letter,
    //       otherwise clear the lease so the job re-surfaces on the next claim.
    void id;
  }

  /**
   * Idempotent consumer helper.
   * Runs effect() exactly once per unique key across repeated calls.
   */
  processOnce(key: string, effect: () => void): void {
    // TODO: track seen keys; if key is new, call effect() and mark it.
    void key; void effect;
  }

  /** Jobs that exceeded maxAttempts and were moved out of the main queue. */
  get deadLetter(): Job[] {
    return []; // TODO
  }
}
