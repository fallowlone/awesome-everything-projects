// TODO(you): implement a token-bucket limiter with an injected clock.
// Tokens refill at `refillPerSec`, capped at `capacity`. `tryRemove` returns
// whether `n` tokens were available (and removes them if so). No Date.now().
export class TokenBucket {
  constructor(capacity: number, refillPerSec: number, now: number) {
    // TODO: store capacity, rate, current tokens (start full), and last refill time.
    void capacity; void refillPerSec; void now;
  }
  tryRemove(now: number, n = 1): boolean {
    void now; void n;
    return false; // TODO: refill since last call, then remove n if available.
  }
  get tokens(): number {
    return 0; // TODO
  }
}
