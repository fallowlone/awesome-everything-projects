// TODO(you): implement a circuit breaker with an injected clock.
// The breaker has three states: 'closed' | 'open' | 'half-open'.
// Use the `now` argument on every method — never call Date.now().
//
// opts.failureThreshold  — consecutive failures (or rate) that trip closed→open
// opts.openMs            — milliseconds before open→half-open (lazy, on next call)
// opts.halfOpenMax       — max probes allowed while half-open (usually 1)
export interface BreakerOpts {
  failureThreshold: number;
  openMs: number;
  halfOpenMax: number;
}

export class CircuitBreaker {
  constructor(_opts: BreakerOpts) {
    // TODO: store opts and initialise state to 'closed'.
  }

  /**
   * Calls fn and returns its value.
   * While open (and before the recovery window): throws without calling fn.
   * While half-open: passes one probe through; success → closed, failure → open.
   * @param fn  The function to guard. May throw.
   * @param now Injected timestamp in milliseconds.
   */
  call<T>(fn: () => T, now: number): T {
    void fn; void now;
    throw new Error("TODO: implement call()");
  }

  /** Returns the current state for the given injected timestamp. */
  state(now: number): 'closed' | 'open' | 'half-open' {
    void now;
    return 'closed'; // TODO
  }
}
