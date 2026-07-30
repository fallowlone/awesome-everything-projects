// TODO(you): room presence + client-side send discipline.
//
// The suite drives the parts that break in real rooms, not in a demo with two tabs
// on localhost:
//   - presence is CURRENT state (one cursor per peer), so a reconnect needs one
//     snapshot rather than a replay;
//   - a stale frame must never teleport a cursor backwards (LWW on `at`, ties keep
//     the stored value);
//   - silent peers expire, or a suspended mobile tab leaves a ghost cursor forever;
//   - pointer events are COALESCED, not dropped — the last position is the one that
//     matters, so the final move must still be sent;
//   - reconnect backoff jitters, or one deploy brings a thousand clients back in
//     lockstep and knocks the server over again.
export type Cursor = { x: number; y: number; at: number };
export type Peer = { id: string; name: string; color: string; cursor: Cursor };

export class Room {
  join(peer: Peer): void {
    void peer; // TODO
  }
  leave(id: string): void {
    void id; // TODO
  }
  /** False when the peer is unknown or the update is not newer. */
  move(id: string, cursor: Cursor): boolean {
    void id; void cursor;
    return false; // TODO
  }
  /** Everyone except the sender. */
  others(id: string): Peer[] {
    void id;
    return []; // TODO
  }
  /** Full state for a joining or reconnecting client, in stable order. */
  snapshot(): Peer[] {
    return []; // TODO
  }
  /** Drop peers idle longer than ttlMs; return removed ids. */
  expire(now: number, ttlMs: number): string[] {
    void now; void ttlMs;
    return []; // TODO
  }
  get size(): number {
    return 0; // TODO
  }
}

export class CoalescingThrottle {
  constructor(private readonly intervalMs: number) {}
  /** The cursor to send now, or null when it should be held. */
  offer(cursor: Cursor, now: number): Cursor | null {
    void cursor; void now; void this.intervalMs;
    return null; // TODO
  }
  /** Send the held position (interval elapsed, or pointer-up). */
  flush(now: number): Cursor | null {
    void now;
    return null; // TODO
  }
  get held(): Cursor | null {
    return null; // TODO
  }
}

export function reconnectDelayMs(
  attempt: number,
  opts: { baseMs: number; capMs: number; rand?: () => number },
): number {
  void attempt; void opts;
  return 0; // TODO
}
